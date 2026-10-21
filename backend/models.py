"""
Pydantic models that mirror the frontend TypeScript interfaces in src/lib/store.ts.
All field names match exactly so JSON serialisation is transparent.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


# ---------------------------------------------------------------------------
# Enumerations / literals
# ---------------------------------------------------------------------------

Classification = Literal["verified", "unverified", "conflicting", "inconclusive"]
Origin = Literal["live-source", "ai-summary", "user-provided"]
RetrievalState = Literal["retrieved", "failed", "not_attempted"]
ReviewStatus = Literal["pending", "review", "completed", "retrieving", "failed"]
CodeType = Literal["CPT", "ICD-10", "HCPCS"]
RetrievalStatus = Literal[
    "not_configured", "queued", "retrieving", "completed", "failed"
]

CATEGORIES: list[str] = [
    "Billing and Coding",
    "Coverage and Eligibility",
    "Medical Necessity",
    "Provider Credentials",
    "Device and Product Claims",
    "Public Health Statement",
    "Other",
]

OUTCOMES: list[str] = [
    "Not determined",
    "Further Review Required",
    "No Further Action",
    "Escalated for Compliance Review",
]


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class BillingCode(BaseModel):
    code: str
    type: CodeType
    description: str = ""


class TimelineEvent(BaseModel):
    date: str  # ISO date string YYYY-MM-DD
    event: str


class RetrievalRun(BaseModel):
    status: RetrievalStatus
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    message: Optional[str] = None


class Evidence(BaseModel):
    id: str
    title: str
    url: str
    publisher: str
    published: Optional[str] = None
    retrieval: RetrievalState
    origin: Origin
    classification: Classification
    summary: str = ""
    retrievedAt: Optional[str] = None
    provider: Optional[Literal["tinyfish"]] = None
    verifies: Optional[str] = None


# ---------------------------------------------------------------------------
# Investigation
# ---------------------------------------------------------------------------


class Investigation(BaseModel):
    id: str
    ref: str
    createdAt: str
    claim: str
    category: str
    details: str = ""
    provider: Optional[str] = None
    sourceUrl: Optional[str] = None
    status: ReviewStatus = "pending"
    sample: bool = False
    summary: Optional[str] = None
    evidence: list[Evidence] = Field(default_factory=list)
    riskIndicators: list[str] = Field(default_factory=list)
    recommendation: Optional[str] = None
    notes: str = ""
    retrievalError: Optional[str] = None
    outcome: Optional[str] = None
    archived: bool = False
    serviceDateFrom: Optional[str] = None
    serviceDateTo: Optional[str] = None
    billingDate: Optional[str] = None
    billedAmount: Optional[float] = None
    billingCodes: Optional[list[BillingCode]] = None
    clinicalTimeline: Optional[list[TimelineEvent]] = None
    reviewerNotes: Optional[str] = None
    retrieval: Optional[RetrievalRun] = None
    savedReports: Optional[list[SavedReport]] = None


# ---------------------------------------------------------------------------
# Request / response bodies
# ---------------------------------------------------------------------------


class CreateInvestigationRequest(BaseModel):
    claim: str = Field(..., min_length=15)
    category: str
    details: str = ""
    provider: Optional[str] = None
    sourceUrl: Optional[str] = None
    ref: Optional[str] = None
    serviceDateFrom: Optional[str] = None
    serviceDateTo: Optional[str] = None
    billingDate: Optional[str] = None
    billedAmount: Optional[float] = None
    billingCodes: Optional[list[BillingCode]] = None
    clinicalTimeline: Optional[list[TimelineEvent]] = None
    reviewerNotes: Optional[str] = None
    runNow: bool = False

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"category must be one of {CATEGORIES}")
        return v


class UpdateInvestigationRequest(BaseModel):
    """All fields optional — PATCH semantics."""

    model_config = ConfigDict(extra="allow")

    status: Optional[ReviewStatus] = None
    outcome: Optional[str] = None
    notes: Optional[str] = None
    summary: Optional[str] = None
    riskIndicators: Optional[list[str]] = None
    recommendation: Optional[str] = None
    archived: Optional[bool] = None
    evidence: Optional[list[Evidence]] = None
    retrieval: Optional[RetrievalRun] = None
    retrievalError: Optional[str] = None


class AddEvidenceRequest(BaseModel):
    title: str = Field(..., min_length=1)
    url: str
    publisher: str = ""
    published: Optional[str] = None
    classification: Classification
    summary: str = ""
    origin: Origin = "user-provided"


class SavedReport(BaseModel):
    id: str
    investigationId: str
    generatedAt: str
    reviewStatus: ReviewStatus
    outcome: str
    snapshot: dict  # full investigation JSON snapshot


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    timestamp: str
    database: Optional[dict] = None
    gemini: Optional[dict] = None
    tinyfish: Optional[dict] = None


class RunRetrievalRequest(BaseModel):
    """Optional override config for a one-off retrieval run."""

    tinyfishEndpoint: Optional[str] = None
    tinyfishApiKey: Optional[str] = None
