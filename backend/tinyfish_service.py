"""
TinyFish service — server-side wrapper for live-web evidence retrieval.

Mirrors the frontend tinyfish.ts interface so the backend can be the
TinyFish proxy endpoint that the frontend settings point to, OR can call
a real TinyFish API if TINYFISH_API_KEY / TINYFISH_ENDPOINT are set.

When credentials are not configured, this module logs a clear warning
and returns a 'not_configured' result; it never fabricates evidence.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    load_dotenv()
except ImportError:
    pass

import httpx

log = logging.getLogger(__name__)

TIMEOUT = 75  # seconds for live-web agent execution

_TINYFISH_ENDPOINT = os.getenv("TINYFISH_ENDPOINT", "").strip()
_TINYFISH_API_KEY = os.getenv("TINYFISH_API_KEY", "").strip()


def normalize_endpoint(ep: str) -> str:
    """
    Ensures TinyFish Agent URL resolves to the exact /v1/automation/run endpoint
    without duplicating URL paths.
    """
    ep = ep.strip().rstrip("/")
    if "agent.tinyfish.ai" in ep.lower():
        if ep.endswith("/v1/automation/run"):
            return ep
        if ep.endswith("/automation/run"):
            prefix = ep[: -len("/automation/run")].rstrip("/")
            if prefix.endswith("/v1"):
                return f"{prefix}/automation/run"
            return f"{prefix}/v1/automation/run"
        if ep.endswith("/v1"):
            return f"{ep}/automation/run"
        return f"{ep}/v1/automation/run"
    return ep


if _TINYFISH_ENDPOINT:
    log.info("TinyFish endpoint configured: %s", normalize_endpoint(_TINYFISH_ENDPOINT))
else:
    log.warning(
        "TINYFISH_ENDPOINT not set – live evidence retrieval is not active. "
        "Set TINYFISH_ENDPOINT and TINYFISH_API_KEY in .env to enable it."
    )

CLASSIFICATION_VALUES = {"verified", "unverified", "conflicting", "inconclusive"}


def get_service_status() -> dict:
    ep = os.getenv("TINYFISH_ENDPOINT", None)
    if ep is None:
        ep = _TINYFISH_ENDPOINT
    key = os.getenv("TINYFISH_API_KEY", None)
    if key is None:
        key = _TINYFISH_API_KEY
    ep = (ep or "").strip()
    key = (key or "").strip()
    norm_ep = normalize_endpoint(ep) if ep else None
    return {
        "configured": bool(norm_ep),
        "endpoint": norm_ep,
        "hasKey": bool(key),
    }


async def retrieve_evidence(inv: dict, endpoint: Optional[str] = None, api_key: Optional[str] = None) -> dict:
    """
    Sends the investigation to TinyFish and returns a RetrievalResult-shaped dict.

    Returns:
        {
            "status": "completed"|"failed"|"not_configured",
            "message": str,
            "evidence": [...],   # only when status=="completed"
            "summary": str,
            "riskIndicators": [...],
            "recommendation": str,
        }
    """
    if endpoint is not None:
        ep = endpoint
    else:
        ep = os.getenv("TINYFISH_ENDPOINT", None)
        if ep is None:
            ep = _TINYFISH_ENDPOINT
    ep = (ep or "").strip()

    if api_key is not None:
        key = api_key
    else:
        key = os.getenv("TINYFISH_API_KEY", None)
        if key is None:
            key = _TINYFISH_API_KEY
    key = (key or "").strip()

    if not ep:
        return {
            "status": "not_configured",
            "message": (
                "No TinyFish endpoint configured. "
                "Set TINYFISH_ENDPOINT in the backend .env to enable live retrieval."
            ),
        }

    ep = normalize_endpoint(ep)
    target_url = inv.get("sourceUrl") or "https://example.com"
    if "agent.tinyfish.ai" in ep.lower():
        # TinyFish Web Agent API format: requires 'url' and 'goal'
        codes_str = ", ".join(
            (c.get("code", "") if isinstance(c, dict) else str(c))
            for c in (inv.get("billingCodes") or [])
        )
        claim_text = inv.get("claim", "")
        goal = (
            f"Extract the page title and an overview summary of clinical, billing, or healthcare policy guidelines from this page related to: '{claim_text}'. "
            f"{f'Relevant billing codes: {codes_str}. ' if codes_str else ''}"
            f"Do not navigate away from this page or browse external links. "
            f"Return a JSON object with keys: title, summary, recommendation."
        )
        payload = {
            "url": target_url,
            "goal": goal,
        }
    else:
        # Standard Medarina pass-through format
        payload = {
            "claim": inv.get("claim", ""),
            "category": inv.get("category", ""),
            "details": inv.get("details", ""),
            "provider": inv.get("provider"),
            "sourceUrl": inv.get("sourceUrl"),
            "billingCodes": inv.get("billingCodes"),
            "serviceDateFrom": inv.get("serviceDateFrom"),
            "serviceDateTo": inv.get("serviceDateTo"),
            "billedAmount": inv.get("billedAmount"),
        }

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if key:
        headers["X-API-Key"] = key

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(ep, json=payload, headers=headers)

        if not resp.is_success:
            return {
                "status": "failed",
                "message": f"The TinyFish service responded with HTTP {resp.status_code}.",
            }

        data = resp.json()

    except httpx.TimeoutException:
        return {
            "status": "failed",
            "message": f"The TinyFish service did not respond within {TIMEOUT} seconds.",
        }
    except httpx.RequestError as exc:
        return {
            "status": "failed",
            "message": f"Could not reach the TinyFish service ({exc}).",
        }
    except json.JSONDecodeError:
        return {
            "status": "failed",
            "message": "The TinyFish service returned an unrecognised response format.",
        }

    if not isinstance(data, dict):
        return {
            "status": "failed",
            "message": "The TinyFish service returned an unrecognised response format.",
        }

    # Extract evidence array from either standard proxy format or TinyFish Agent API result
    raw_evidence = data.get("evidence")
    extracted_summary = data.get("summary")
    extracted_risks = data.get("riskIndicators") or []
    extracted_rec = data.get("recommendation")

    if raw_evidence is None and isinstance(data.get("result"), dict):
        raw_evidence = data["result"].get("evidence")
        if not extracted_summary:
            extracted_summary = data["result"].get("summary")
        if not extracted_risks:
            extracted_risks = data["result"].get("riskIndicators") or []
        if not extracted_rec:
            extracted_rec = data["result"].get("recommendation")
    elif raw_evidence is None and isinstance(data.get("result"), list):
        raw_evidence = data["result"]
    elif raw_evidence is None and isinstance(data.get("result"), str):
        try:
            parsed_res = json.loads(data["result"])
            if isinstance(parsed_res, dict):
                raw_evidence = parsed_res.get("evidence")
                if not extracted_summary:
                    extracted_summary = parsed_res.get("summary")
                if not extracted_risks:
                    extracted_risks = parsed_res.get("riskIndicators") or []
                if not extracted_rec:
                    extracted_rec = parsed_res.get("recommendation")
            elif isinstance(parsed_res, list):
                raw_evidence = parsed_res
        except Exception:
            if not extracted_summary:
                extracted_summary = data["result"]

    now = datetime.now(timezone.utc).isoformat()

    def parse_ev(e: Any) -> Optional[dict]:
        if not isinstance(e, dict):
            return None
        title = e.get("title")
        url = e.get("url") or target_url
        if not isinstance(title, str) or not isinstance(url, str):
            return None
        classification = e.get("classification", "inconclusive")
        if classification not in CLASSIFICATION_VALUES:
            classification = "inconclusive"
        origin = e.get("origin", "live-source")
        if origin not in ("live-source", "ai-summary", "user-provided"):
            origin = "live-source"
        try:
            hostname = url.split("/")[2]
        except IndexError:
            hostname = url
        return {
            "id": str(uuid.uuid4()),
            "title": title,
            "url": url,
            "publisher": e.get("publisher") or hostname,
            "published": e.get("published") or None,
            "retrieval": "failed" if e.get("retrieval") == "failed" else "retrieved",
            "origin": origin,
            "classification": classification,
            "summary": str(e.get("summary", "")),
            "retrievedAt": now,
            "provider": "tinyfish",
            "verifies": e.get("verifies") or e.get("claimDetail") or None,
        }

    evidence = [ev for e in (raw_evidence or []) for ev in [parse_ev(e)] if ev is not None]

    # If TinyFish returned a summary result but no separate evidence items, create a structured live evidence item
    if not evidence and extracted_summary:
        title_from_result = (data.get("result", {}).get("title") if isinstance(data.get("result"), dict) else None)
        hostname = target_url.split("/")[2] if "/" in target_url else "Web Source"
        evidence.append({
            "id": str(uuid.uuid4()),
            "title": title_from_result or f"Live Source ({hostname})",
            "url": target_url,
            "publisher": hostname,
            "published": None,
            "retrieval": "retrieved",
            "origin": "live-source",
            "classification": "verified" if any(w in extracted_summary.lower() for w in ("support", "covered", "eligible", "approved", "standard")) else "unverified",
            "summary": str(extracted_summary),
            "retrievedAt": now,
            "provider": "tinyfish",
            "verifies": inv.get("claim"),
        })

    return {
        "status": "completed",
        "message": f"{len(evidence)} source{'s' if len(evidence) != 1 else ''} retrieved.",
        "evidence": evidence,
        "summary": str(extracted_summary or "") or None,
        "riskIndicators": [
            r for r in extracted_risks if isinstance(r, str)
        ],
        "recommendation": str(extracted_rec or "") or None,
    }


async def test_connection(endpoint: str, api_key: str = "") -> dict:
    """Ping the endpoint to verify it's reachable and authenticated."""
    ep = normalize_endpoint(endpoint.strip())
    if not ep:
        return {"ok": False, "message": "No endpoint provided."}
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(ep, json={"ping": True}, headers=headers)
        if resp.is_success:
            return {
                "ok": True,
                "message": f"Endpoint responded with HTTP {resp.status_code}.",
            }
        # TinyFish Agent API returns 400 INVALID_INPUT for {"ping": True} because it validates schema,
        # but returns 401 Unauthorized if the API key is invalid.
        if "tinyfish.ai" in ep.lower() and resp.status_code == 400:
            return {
                "ok": True,
                "message": "TinyFish Agent API connected and authenticated.",
            }
        if resp.status_code == 401:
            return {
                "ok": False,
                "message": "TinyFish API key rejected (HTTP 401 Unauthorized).",
            }
        return {
            "ok": False,
            "message": f"Endpoint responded with HTTP {resp.status_code}.",
        }
    except httpx.TimeoutException:
        return {"ok": False, "message": "The endpoint did not respond within 20 seconds."}
    except httpx.RequestError as exc:
        return {"ok": False, "message": f"Could not reach the endpoint ({exc})."}

