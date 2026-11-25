from typing import Any

from pydantic import BaseModel


class XraySample(BaseModel):
    id: str
    title: str
    description: str
    type: str
    thumbnail: str


class XrayEngineStatus(BaseModel):
    status: str
    service: str
    engine_url: str
    device: str | None = None
    checkpoint_loaded: bool = False
    details: dict[str, Any] | None = None


class XraySaveToPatientRequest(BaseModel):
    patient_id: int
    session_id: str
    title: str | None = "Oral-3D Teeth Reconstruction"
    notes: str | None = None
    model_urls: dict[str, str]
    metrics: dict[str, Any]
    input_scan_url: str | None = None
