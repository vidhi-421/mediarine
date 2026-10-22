"""
Basic tests for the Medarina backend.
Run with:  py -m pytest backend/tests/ -v

These tests use the in-memory database (no Supabase required).
"""

from __future__ import annotations

import json
import sys
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

# Patch env so no external services are required
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("TINYFISH_ENDPOINT", "")

from main import app  # noqa: E402  (must come after env patch)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


# ---------------------------------------------------------------------------
# Investigation CRUD
# ---------------------------------------------------------------------------


VALID_PAYLOAD = {
    "claim": "Provider billed 11 units of therapeutic exercise for one patient on a single date of service.",
    "category": "Billing and Coding",
    "details": "Outpatient rehab claim.",
    "provider": "Riverside Rehab",
    "serviceDateFrom": "2026-02-01",
    "serviceDateTo": "2026-02-01",
    "billingDate": "2026-02-03",
    "billedAmount": 420.0,
    "billingCodes": [{"code": "97110", "type": "CPT", "description": "Therapeutic exercise"}],
    "runNow": False,
}


def _create_investigation():
    r = client.post("/api/investigations", json=VALID_PAYLOAD)
    assert r.status_code == 201
    data = r.json()
    assert data["claim"] == VALID_PAYLOAD["claim"]
    assert data["status"] == "pending"
    assert data["sample"] is False
    assert "id" in data
    return data["id"]


def test_create_investigation():
    inv_id = _create_investigation()
    assert inv_id is not None


def test_list_investigations():
    # ensure at least one record
    client.post("/api/investigations", json=VALID_PAYLOAD)
    r = client.get("/api/investigations")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_get_investigation():
    inv_id = _create_investigation()
    r = client.get(f"/api/investigations/{inv_id}")
    assert r.status_code == 200
    assert r.json()["id"] == inv_id


def test_get_investigation_not_found():
    r = client.get("/api/investigations/nonexistent-id")
    assert r.status_code == 404


def test_update_investigation():
    inv_id = _create_investigation()
    r = client.patch(
        f"/api/investigations/{inv_id}",
        json={"status": "review", "outcome": "Further Review Required", "notes": "Need more docs."},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "review"
    assert data["notes"] == "Need more docs."


def test_delete_investigation():
    inv_id = _create_investigation()
    r = client.delete(f"/api/investigations/{inv_id}")
    assert r.status_code == 204
    r2 = client.get(f"/api/investigations/{inv_id}")
    assert r2.status_code == 404


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_create_investigation_short_claim():
    bad = {**VALID_PAYLOAD, "claim": "Too short"}
    r = client.post("/api/investigations", json=bad)
    assert r.status_code == 422


def test_create_investigation_bad_category():
    bad = {**VALID_PAYLOAD, "category": "Invalid Category"}
    r = client.post("/api/investigations", json=bad)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


def test_add_evidence():
    inv_id = _create_investigation()
    ev_payload = {
        "title": "CMS billing guidance",
        "url": "https://www.cms.gov/guidance",
        "publisher": "CMS",
        "classification": "verified",
        "summary": "Timed codes are reported in 15-minute units.",
        "origin": "user-provided",
    }
    r = client.post(f"/api/investigations/{inv_id}/evidence", json=ev_payload)
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == ev_payload["title"]
    assert "id" in data

    # Confirm it appears on the investigation
    r2 = client.get(f"/api/investigations/{inv_id}")
    assert any(e["id"] == data["id"] for e in r2.json()["evidence"])


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


def test_save_and_get_report():
    inv_id = _create_investigation()
    r = client.post(f"/api/investigations/{inv_id}/reports")
    assert r.status_code == 201
    report = r.json()
    assert report["investigationId"] == inv_id

    r2 = client.get(f"/api/reports/{report['id']}")
    assert r2.status_code == 200
    assert r2.json()["id"] == report["id"]


def test_list_inv_reports():
    inv_id = _create_investigation()
    client.post(f"/api/investigations/{inv_id}/reports")
    r = client.get(f"/api/investigations/{inv_id}/reports")
    assert r.status_code == 200
    assert len(r.json()["items"]) >= 1


def test_list_all_reports():
    r = client.get("/api/reports")
    assert r.status_code == 200
    assert "items" in r.json()


# ---------------------------------------------------------------------------
# Analysis (no Gemini key — falls back to rule-based)
# ---------------------------------------------------------------------------


def test_analyse_no_evidence():
    inv_id = _create_investigation()
    r = client.post(f"/api/investigations/{inv_id}/analyse")
    assert r.status_code == 200
    data = r.json()
    assert "verificationQuestions" in data
    assert isinstance(data["verificationQuestions"], list)
    assert len(data["verificationQuestions"]) >= 1


def test_analyse_with_evidence():
    inv_id = _create_investigation()
    client.post(
        f"/api/investigations/{inv_id}/evidence",
        json={"title": "CMS guide", "url": "https://cms.gov", "classification": "verified", "summary": "Units guidance.", "origin": "user-provided"},
    )
    client.post(
        f"/api/investigations/{inv_id}/evidence",
        json={"title": "Payer policy", "url": "https://payer.example.com", "classification": "conflicting", "summary": "Contradicts CMS.", "origin": "user-provided"},
    )
    r = client.post(f"/api/investigations/{inv_id}/analyse")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["riskIndicators"], list)


# ---------------------------------------------------------------------------
# TinyFish ping (no endpoint configured)
# ---------------------------------------------------------------------------


def test_tinyfish_ping():
    r = client.post("/api/tinyfish/retrieve", json={"ping": True})
    assert r.status_code == 200


def test_tinyfish_retrieve_not_configured():
    r = client.post(
        "/api/tinyfish/retrieve",
        json={"claim": "Test claim about billing codes.", "category": "Billing and Coding"},
    )
    # Not configured → 503
    assert r.status_code == 503


def test_health_integration_statuses():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert "database" in data
    assert "gemini" in data
    assert data["database"]["mode"] in ("supabase", "in-memory (development fallback only)")
    assert isinstance(data["database"]["configured"], bool)
    assert isinstance(data["gemini"]["configured"], bool)
    assert isinstance(data["tinyfish"]["configured"], bool)


def test_analyse_distinguishes_source():
    inv_id = _create_investigation()
    r = client.post(f"/api/investigations/{inv_id}/analyse")
    assert r.status_code == 200
    data = r.json()
    assert data.get("analysisSource") == "rule-based-fallback"


def test_database_update_extra_fields():
    inv_id = _create_investigation()
    # Update with known and extra fields to ensure database layer handles safely
    r = client.patch(
        f"/api/investigations/{inv_id}",
        json={"outcome": "No Further Action", "customField": "extra_data"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["outcome"] == "No Further Action"


def test_tinyfish_status():
    r = client.get("/api/tinyfish/status")
    assert r.status_code == 200
    data = r.json()
    assert "configured" in data
    assert "status" in data
    assert "lastRun" in data
    assert data["status"] in ("connected", "unavailable", "not_configured")


def test_get_and_update_investigation_by_ref():
    inv_id = _create_investigation()
    inv_data = client.get(f"/api/investigations/{inv_id}").json()
    ref = inv_data["ref"]
    assert ref.startswith("INV-")

    # Get by ref
    r_by_ref = client.get(f"/api/investigations/{ref}")
    assert r_by_ref.status_code == 200
    assert r_by_ref.json()["id"] == inv_id

    # Update by ref
    patch_res = client.patch(f"/api/investigations/{ref}", json={"notes": "Updated via ref"})
    assert patch_res.status_code == 200
    assert patch_res.json()["notes"] == "Updated via ref"

    # Verify updated via original id
    verified = client.get(f"/api/investigations/{inv_id}").json()
    assert verified["notes"] == "Updated via ref"


def test_tinyfish_timeout_and_normalization():
    import tinyfish_service as tf
    assert tf.TIMEOUT == 180
    assert tf.normalize_endpoint("https://agent.tinyfish.ai") == "https://agent.tinyfish.ai/v1/automation/run"
    assert tf.normalize_endpoint("https://agent.tinyfish.ai/v1") == "https://agent.tinyfish.ai/v1/automation/run"
    assert tf.normalize_endpoint("https://agent.tinyfish.ai/v1/automation/run") == "https://agent.tinyfish.ai/v1/automation/run"


def test_tinyfish_test_endpoint_empty():
    r = client.post("/api/tinyfish/test", json={"endpoint": ""})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is False
    assert "No endpoint provided" in data["message"]


def test_tinyfish_test_endpoint_mock_400():
    import tinyfish_service as tf
    import httpx
    import pytest

    # Mock an authenticated TinyFish Agent API 400 INVALID_INPUT schema response
    class MockResp:
        status_code = 400
        is_success = False

        def json(self):
            return {"error": {"code": "INVALID_INPUT", "message": "Field 'url' required"}}

    async def run_test():
        orig_post = httpx.AsyncClient.post
        async def mock_post(self, url, *args, **kwargs):
            return MockResp()
        httpx.AsyncClient.post = mock_post
        try:
            res = await tf.test_connection("https://agent.tinyfish.ai/v1/automation/run", "test-key")
            assert res["ok"] is True
            assert "connected and authenticated" in res["message"].lower()
        finally:
            httpx.AsyncClient.post = orig_post

    import asyncio
    asyncio.run(run_test())


