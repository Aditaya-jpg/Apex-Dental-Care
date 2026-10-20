from typing import Any, Dict, List, Optional
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
    device: Optional[str] = None
    checkpoint_loaded: bool = False
    details: Optional[Dict[str, Any]] = None


class XraySaveToPatientRequest(BaseModel):
    patient_id: int
    session_id: str
    title: Optional[str] = "Oral-3D Teeth Reconstruction"
    notes: Optional[str] = None
    model_urls: Dict[str, str]
    metrics: Dict[str, Any]
    input_scan_url: Optional[str] = None
