"""
Gemini service — generates verification questions and analyses evidence.
Only makes real API calls when GEMINI_API_KEY is configured.
Produces explainable findings; never declares fraud from absence alone.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    load_dotenv()
except ImportError:
    pass

log = logging.getLogger(__name__)

_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

_client = None


def get_gemini_client():
    global _client
    if _client is not None:
        return _client
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key, transport="rest")
            model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
            _client = genai.GenerativeModel(model_name)
            log.info("Gemini client initialized (model=%s).", model_name)
        except Exception as exc:  # pragma: no cover
            log.warning("Could not initialize Gemini client: %s", exc)
    return _client


# Initial check on module load
try:
    if _GEMINI_API_KEY:
        get_gemini_client()
    else:
        log.warning("GEMINI_API_KEY not set – using rule-based fallback analysis.")
except Exception as exc:  # pragma: no cover
    log.warning("Could not initialize Gemini client on load: %s", exc)


def get_service_status() -> dict:
    client = get_gemini_client()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    return {
        "configured": bool(api_key),
        "model": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
        "ready": client is not None,
    }


# ---------------------------------------------------------------------------
# Verification questions
# ---------------------------------------------------------------------------


def verification_questions(inv: dict) -> list[str]:
    """
    Generate claim-specific verification questions.
    Falls back to rule-based questions when Gemini is unavailable.
    """
    client = get_gemini_client()
    if client is None:
        return _rule_based_questions(inv)

    prompt = (
        "You are a healthcare claims investigator. "
        "Given the claim details below, list up to 8 concise verification questions "
        "a reviewer should research. Focus on billing codes, clinical necessity, "
        "provider credentials, and policy compliance. "
        "Return only a JSON array of question strings. Do not add commentary.\n\n"
        f"Claim: {inv.get('claim', '')}\n"
        f"Category: {inv.get('category', '')}\n"
        f"Provider: {inv.get('provider', 'Not specified')}\n"
        f"Billing codes: {json.dumps(inv.get('billingCodes', []))}\n"
        f"Service dates: {inv.get('serviceDateFrom', '')} to {inv.get('serviceDateTo', '')}\n"
        f"Billed amount: {inv.get('billedAmount', 'Not specified')}\n"
        f"Details: {inv.get('details', '')}"
    )

    try:
        resp = client.generate_content(prompt)
        text = resp.text.strip()
        # strip code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        questions = json.loads(text)
        if isinstance(questions, list) and all(isinstance(q, str) for q in questions):
            return questions[:8]
    except Exception as exc:
        log.warning("Gemini verification_questions failed: %s", exc)

    return _rule_based_questions(inv)


def _rule_based_questions(inv: dict) -> list[str]:
    """Deterministic question generation matching the frontend report.ts logic."""
    q: list[str] = []
    if inv.get("provider"):
        q.append(
            f"Is {inv['provider']} enrolled and eligible to bill for the services claimed?"
        )
    for c in inv.get("billingCodes") or []:
        if isinstance(c, dict):
            code, ctype, desc = c.get("code", ""), c.get("type", ""), c.get("description", "")
        else:
            code, ctype, desc = c.code, c.type, c.description
        if ctype == "ICD-10":
            q.append(f"Does diagnosis {code} support the services billed?")
        else:
            q.append(
                f"Does published guidance support billing {ctype} {code}"
                f"{f' ({desc})' if desc else ''} in this context?"
            )
    if inv.get("serviceDateFrom"):
        date_range = inv["serviceDateFrom"]
        if inv.get("serviceDateTo") and inv["serviceDateTo"] != inv["serviceDateFrom"]:
            date_range += f" to {inv['serviceDateTo']}"
        q.append(f"Are the services consistent with the dates of service {date_range}?")
    if inv.get("billedAmount") is not None:
        q.append(
            f"Is the billed amount of ${inv['billedAmount']:.2f} consistent with the services documented?"
        )
    if not q:
        q.append("Is the claim statement supported by a citable public source?")
    return q


# ---------------------------------------------------------------------------
# Evidence analysis
# ---------------------------------------------------------------------------


def analyse_evidence(inv: dict) -> dict:
    """
    Analyse the investigation's evidence and return:
      summary, riskIndicators, recommendation, analysisSource
    Never fabricates evidence or declares fraud from missing information.
    """
    evidence = inv.get("evidence") or []
    if not evidence:
        return {
            "summary": "No evidence has been retrieved or added; no analysis can be performed.",
            "riskIndicators": [],
            "recommendation": None,
            "analysisSource": "rule-based-fallback",
        }

    client = get_gemini_client()
    if client is None:
        return _rule_based_analysis(inv)

    ev_text = "\n".join(
        f"- [{e.get('classification','?')}] {e.get('title','')}: {e.get('summary','')}"
        for e in evidence
        if isinstance(e, dict)
    )

    prompt = (
        "You are a healthcare claims analyst. "
        "Analyse the evidence below for the given claim. "
        "Return a JSON object with keys:\n"
        "  summary (string): one paragraph summarising the evidence, "
        "   do NOT declare fraud or use probability language.\n"
        "  riskIndicators (array of strings): factual flags only, "
        "   each grounded in retrieved evidence.\n"
        "  recommendation (string): suggested next steps for a human reviewer.\n\n"
        "Rules:\n"
        "- Distinguish supported facts, contradictions, missing evidence, and open questions.\n"
        "- Never fabricate URLs or sources.\n"
        "- Never declare fraud based on missing information alone.\n\n"
        f"Claim: {inv.get('claim', '')}\n"
        f"Category: {inv.get('category', '')}\n"
        f"Evidence:\n{ev_text}"
    )

    try:
        resp = client.generate_content(prompt)
        text = resp.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text)
        if isinstance(result, dict):
            return {
                "summary": str(result.get("summary", "")),
                "riskIndicators": [
                    str(r) for r in result.get("riskIndicators", []) if isinstance(r, str)
                ],
                "recommendation": str(result.get("recommendation", "")) or None,
                "analysisSource": "gemini",
                "model": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            }
    except Exception as exc:
        log.warning("Gemini analyse_evidence failed: %s", exc)

    return _rule_based_analysis(inv)


def _rule_based_analysis(inv: dict) -> dict:
    evidence = inv.get("evidence") or []
    verified = [e for e in evidence if isinstance(e, dict) and e.get("classification") == "verified"]
    conflicting = [e for e in evidence if isinstance(e, dict) and e.get("classification") == "conflicting"]
    unverified = [e for e in evidence if isinstance(e, dict) and e.get("classification") in ("unverified", "inconclusive")]

    parts: list[str] = []
    if verified:
        parts.append(f"{len(verified)} source(s) support the claim.")
    if conflicting:
        parts.append(f"{len(conflicting)} source(s) conflict with the claim.")
    if unverified:
        parts.append(f"{len(unverified)} source(s) are unverified or inconclusive.")

    summary = " ".join(parts) if parts else "Insufficient evidence to assess."

    risks: list[str] = []
    if conflicting:
        risks.append("Conflicting evidence identified — human review recommended before any determination.")

    rec = None
    if conflicting:
        rec = "Review conflicting sources and obtain additional documentation before closing."
    elif verified and not conflicting:
        rec = "Supporting evidence identified. A reviewer should confirm before closing."
    else:
        rec = "Retrieve or add evidence before making a determination."

    return {
        "summary": summary,
        "riskIndicators": risks,
        "recommendation": rec,
        "analysisSource": "rule-based-fallback",
    }
