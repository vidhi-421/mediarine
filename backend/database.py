"""
Database layer — Supabase PostgreSQL via the supabase-py client.

Falls back to an in-memory store when SUPABASE_URL / SUPABASE_SERVICE_KEY
are not configured so that the server still starts and the frontend can
connect without a database.

All public functions accept / return plain dicts or lists of dicts that
correspond to the Pydantic models in models.py.
"""

from __future__ import annotations

import os
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    load_dotenv()
except ImportError:
    pass

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase client (optional)
# ---------------------------------------------------------------------------

_supabase = None


def get_supabase_client():
    global _supabase
    if _supabase is not None:
        return _supabase
    try:
        from dotenv import load_dotenv

        load_dotenv(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
            override=False,
        )
    except Exception:
        pass
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if url and key:
        try:
            from supabase import create_client

            _supabase = create_client(url, key)
            log.info("Supabase client initialized.")
        except Exception as exc:  # pragma: no cover
            log.warning("Could not initialize Supabase client: %s", exc)
    return _supabase


# Initial try on module load
try:
    _url = os.getenv("SUPABASE_URL", "").strip()
    _key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if _url and _key:
        get_supabase_client()
    else:
        log.warning(
            "SUPABASE_URL or SUPABASE_SERVICE_KEY not set – using in-memory store (development fallback only)."
        )
except Exception as exc:  # pragma: no cover
    log.warning("Could not initialize Supabase client on load: %s", exc)


def get_database_status() -> dict:
    client = get_supabase_client()
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    configured = bool(url and key)
    return {
        "connected": client is not None,
        "mode": "supabase" if client is not None else "in-memory (development fallback only)",
        "configured": configured,
        "projectUrl": url if url else None,
    }


INVESTIGATION_DB_COLUMNS = {
    "id",
    "ref",
    "created_at",
    "claim",
    "category",
    "details",
    "provider",
    "source_url",
    "status",
    "sample",
    "summary",
    "evidence",
    "risk_indicators",
    "recommendation",
    "notes",
    "retrieval_error",
    "outcome",
    "archived",
    "service_date_from",
    "service_date_to",
    "billing_date",
    "billed_amount",
    "billing_codes",
    "clinical_timeline",
    "reviewer_notes",
    "retrieval",
}

# ---------------------------------------------------------------------------
# In-memory fallback
# ---------------------------------------------------------------------------

_mem_investigations: dict[str, dict] = {}
_mem_reports: dict[str, dict] = {}  # keyed by report id


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _inv_from_row(row: dict) -> dict:
    """
    Supabase stores nested JSON columns as Python objects already.
    We just normalise keys so the API returns camelCase.
    """
    return row


def _to_snake(d: dict) -> dict:
    """
    The DB schema uses snake_case columns; model uses camelCase.
    Map the fields that differ.
    """
    mapping = {
        "createdAt": "created_at",
        "sourceUrl": "source_url",
        "billedAmount": "billed_amount",
        "billingDate": "billing_date",
        "serviceDateFrom": "service_date_from",
        "serviceDateTo": "service_date_to",
        "billingCodes": "billing_codes",
        "clinicalTimeline": "clinical_timeline",
        "reviewerNotes": "reviewer_notes",
        "riskIndicators": "risk_indicators",
        "retrievalError": "retrieval_error",
    }
    result: dict = {}
    for k, v in d.items():
        result[mapping.get(k, k)] = v
    return result


def _from_snake(row: dict) -> dict:
    """DB row → camelCase dict."""
    mapping = {
        "created_at": "createdAt",
        "source_url": "sourceUrl",
        "billed_amount": "billedAmount",
        "billing_date": "billingDate",
        "service_date_from": "serviceDateFrom",
        "service_date_to": "serviceDateTo",
        "billing_codes": "billingCodes",
        "clinical_timeline": "clinicalTimeline",
        "reviewer_notes": "reviewerNotes",
        "risk_indicators": "riskIndicators",
        "retrieval_error": "retrievalError",
    }
    result: dict = {}
    for k, v in row.items():
        result[mapping.get(k, k)] = v
    return result


# ---------------------------------------------------------------------------
# Investigations CRUD
# ---------------------------------------------------------------------------


def list_investigations(
    archived: Optional[bool] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict]:
    client = get_supabase_client()
    if client:
        query = client.table("investigations").select("*")
        if archived is not None:
            query = query.eq("archived", archived)
        if status:
            query = query.eq("status", status)
        if category:
            query = query.eq("category", category)
        if q:
            query = query.or_(
                f"ref.ilike.%{q}%,claim.ilike.%{q}%,summary.ilike.%{q}%,provider.ilike.%{q}%"
            )
        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return [_from_snake(r) for r in (res.data or [])]
    # in-memory (development fallback)
    items = list(_mem_investigations.values())
    if archived is not None:
        items = [i for i in items if i.get("archived", False) == archived]
    if status:
        items = [i for i in items if i.get("status") == status]
    if category:
        items = [i for i in items if i.get("category") == category]
    if q:
        ql = q.lower()
        items = [
            i
            for i in items
            if any(
                ql in str(i.get(f, "")).lower()
                for f in ["ref", "claim", "summary", "provider"]
            )
        ]
    items.sort(key=lambda i: i.get("createdAt", ""), reverse=True)
    return items[offset : offset + limit]


def get_investigation(inv_id: str) -> Optional[dict]:
    client = get_supabase_client()
    if client:
        try:
            res = (
                client.table("investigations").select("*").eq("id", inv_id).execute()
            )
            rows = res.data or []
            return _from_snake(rows[0]) if rows else None
        except Exception as exc:
            log.warning("get_investigation(%s) error: %s", inv_id, exc)
            return None
    return _mem_investigations.get(inv_id)


def create_investigation(data: dict) -> dict:
    """
    data is a camelCase dict matching CreateInvestigationRequest fields.
    Returns the saved investigation dict.
    """
    year = datetime.now().year
    client = get_supabase_client()
    existing_count = len(_mem_investigations) if not client else _count_real()
    ref = (data.get("ref") or "").strip() or f"INV-{year}-{str(existing_count + 1).zfill(4)}"

    inv: dict = {
        "id": str(uuid.uuid4()),
        "ref": ref,
        "createdAt": _now(),
        "claim": data["claim"].strip(),
        "category": data["category"],
        "details": (data.get("details") or "").strip(),
        "provider": (data.get("provider") or "").strip() or None,
        "sourceUrl": (data.get("sourceUrl") or "").strip() or None,
        "status": "pending",
        "sample": False,
        "summary": None,
        "evidence": [],
        "riskIndicators": [],
        "recommendation": None,
        "notes": "",
        "retrievalError": None,
        "outcome": None,
        "archived": False,
        "serviceDateFrom": data.get("serviceDateFrom") or None,
        "serviceDateTo": data.get("serviceDateTo") or None,
        "billingDate": data.get("billingDate") or None,
        "billedAmount": data.get("billedAmount"),
        "billingCodes": [c if isinstance(c, dict) else c.model_dump() for c in (data.get("billingCodes") or [])],
        "clinicalTimeline": [t if isinstance(t, dict) else t.model_dump() for t in (data.get("clinicalTimeline") or [])],
        "reviewerNotes": (data.get("reviewerNotes") or "").strip() or None,
        "retrieval": {"status": "retrieving", "startedAt": _now()} if data.get("runNow") else None,
    }

    if client:
        row = _to_snake(inv)
        valid_row = {k: v for k, v in row.items() if k in INVESTIGATION_DB_COLUMNS}
        client.table("investigations").insert(valid_row).execute()
    else:
        _mem_investigations[inv["id"]] = inv

    return inv


def _count_real() -> int:
    client = get_supabase_client()
    if not client:
        return 0
    try:
        res = client.table("investigations").select("id", count="exact").execute()
        return res.count or 0
    except Exception:
        return 0


def update_investigation(inv_id: str, patch: dict) -> Optional[dict]:
    """patch is camelCase."""
    existing = get_investigation(inv_id)
    if existing is None:
        return None

    updated = {**existing, **{k: v for k, v in patch.items() if v is not None}}
    # allow explicit False / empty list
    for k, v in patch.items():
        if v is False or v == [] or v == "":
            updated[k] = v

    client = get_supabase_client()
    if client:
        snake_patch = _to_snake({k: v for k, v in patch.items()})
        valid_patch = {
            k: v for k, v in snake_patch.items() if k in INVESTIGATION_DB_COLUMNS and k != "id"
        }
        if valid_patch:
            client.table("investigations").update(valid_patch).eq("id", inv_id).execute()
    else:
        _mem_investigations[inv_id] = updated

    return updated


def delete_investigation(inv_id: str) -> bool:
    client = get_supabase_client()
    if client:
        existing = get_investigation(inv_id)
        if existing is None:
            return False
        try:
            client.table("investigations").delete().eq("id", inv_id).execute()
            return True
        except Exception as exc:
            log.warning("delete_investigation(%s) error: %s", inv_id, exc)
            return False
    if inv_id in _mem_investigations:
        del _mem_investigations[inv_id]
        return True
    return False


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


def add_evidence(inv_id: str, ev: dict) -> Optional[dict]:
    inv = get_investigation(inv_id)
    if inv is None:
        return None
    ev = {**ev, "id": str(uuid.uuid4()), "retrievedAt": _now()}
    evidence = list(inv.get("evidence", []))
    evidence.append(ev)
    update_investigation(inv_id, {"evidence": evidence})
    return ev


# ---------------------------------------------------------------------------
# Saved Reports
# ---------------------------------------------------------------------------


def save_report(inv_id: str) -> Optional[dict]:
    inv = get_investigation(inv_id)
    if inv is None:
        return None

    snapshot = {k: v for k, v in inv.items()}
    report: dict = {
        "id": str(uuid.uuid4()),
        "investigationId": inv_id,
        "generatedAt": _now(),
        "reviewStatus": inv.get("status", "pending"),
        "outcome": inv.get("outcome") or "Not determined",
        "snapshot": snapshot,
    }

    client = get_supabase_client()
    if client:
        client.table("saved_reports").insert(
            {
                "id": report["id"],
                "investigation_id": inv_id,
                "generated_at": report["generatedAt"],
                "review_status": report["reviewStatus"],
                "outcome": report["outcome"],
                "snapshot": snapshot,
            }
        ).execute()
    else:
        _mem_reports[report["id"]] = report

    return report


def list_reports(inv_id: Optional[str] = None) -> list[dict]:
    client = get_supabase_client()
    if client:
        query = client.table("saved_reports").select("*").order(
            "generated_at", desc=True
        )
        if inv_id:
            query = query.eq("investigation_id", inv_id)
        res = query.execute()
        rows = res.data or []
        return [
            {
                "id": r["id"],
                "investigationId": r["investigation_id"],
                "generatedAt": r["generated_at"],
                "reviewStatus": r["review_status"],
                "outcome": r["outcome"],
                "snapshot": r["snapshot"],
            }
            for r in rows
        ]
    reports = list(_mem_reports.values())
    if inv_id:
        reports = [r for r in reports if r["investigationId"] == inv_id]
    reports.sort(key=lambda r: r["generatedAt"], reverse=True)
    return reports


def get_report(report_id: str) -> Optional[dict]:
    client = get_supabase_client()
    if client:
        try:
            res = (
                client.table("saved_reports")
                .select("*")
                .eq("id", report_id)
                .execute()
            )
            rows = res.data or []
            if not rows:
                return None
            r = rows[0]
            return {
                "id": r["id"],
                "investigationId": r["investigation_id"],
                "generatedAt": r["generated_at"],
                "reviewStatus": r["review_status"],
                "outcome": r["outcome"],
                "snapshot": r["snapshot"],
            }
        except Exception as exc:
            log.warning("get_report(%s) error: %s", report_id, exc)
            return None
    return _mem_reports.get(report_id)
