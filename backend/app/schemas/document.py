from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    id: int
    patient_id: int
    clinical_record_id: int | None = None
    visit_id: int | None = None
    uploaded_by_user_id: int | None = None
    document_type: str
    title: str = ""
    description: str | None = None
    notes: str | None = None
    disease_category: str | None = None
    treatment_stage: str = "initial_assessment"
    media_date: date
    is_shared_with_patient: bool = False
    storage_key: str
    file_name: str | None = None
    original_filename: str
    original_file_name: str | None = None
    mime_type: str
    file_size_bytes: int
    file_size: int | None = None
    is_encrypted: bool = True
    sha256_checksum: str
    created_at: datetime
    patient_name: str | None = None
    uploaded_by_name: str | None = None
    model_config = ConfigDict(from_attributes=True)


class DocumentUpdate(BaseModel):
    document_type: str | None = None
    title: str | None = None
    description: str | None = None
    disease_category: str | None = None
    treatment_stage: str | None = None
    media_date: date | None = None
    is_shared_with_patient: bool | None = None


class DocumentShareUpdate(BaseModel):
    is_shared_with_patient: bool
