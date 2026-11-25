from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


def _split_full_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(None, 1)
    first = parts[0] if parts else ""
    last = parts[1].strip() if len(parts) > 1 else ""
    return first, last


class MedicalHistoryBase(BaseModel):
    allergies: str | None = None
    medical_conditions: str | None = None
    current_medications: str | None = None
    past_surgeries: str | None = None
    bleeding_disorders: bool = False
    is_pregnant: bool = False
    notes: str | None = None


class MedicalHistoryResponse(MedicalHistoryBase):
    id: int | None = None
    patient_id: int | None = None
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class DentalHistoryBase(BaseModel):
    chief_complaint: str | None = None
    past_dental_treatments: str | None = None
    brushing_frequency: str | None = "Twice daily"
    flossing: bool = False
    habits: str | None = None
    dental_anxiety_level: str | None = "None"
    notes: str | None = None


class DentalHistoryResponse(DentalHistoryBase):
    id: int | None = None
    patient_id: int | None = None
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class PatientBase(BaseModel):
    full_name: str | None = None
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    date_of_birth: date
    gender: str = Field(pattern="^(Male|Female|Other)$")
    phone: str = Field(min_length=5, max_length=50)
    email: EmailStr | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    blood_group: str | None = None
    preferred_language: str = Field(default="en", pattern="^(en|hi|pa)$")
    doctor_id: int | None = None
    student_id: int | None = None
    cr_number: str | None = None
    disease_categories: list[str] = []
    case_keywords: list[str] = []
    special_case_flag: bool = False
    pain_scale: int = Field(default=0, ge=0, le=10)
    severity_level: str = Field(default="none", pattern="^(none|mild|moderate|severe|critical)$")
    parent_consent_required: bool = False
    parent_guardian_name: str | None = None
    parent_guardian_phone: str | None = None
    parent_consent_status: str = "not_required"
    parent_consent_doc_id: int | None = None
    card_doc_id: int | None = None
    card_verification_status: str = "pending"
    tracker_stage: str = "registered"
    source_channel: str = "walk_in"


class PatientCreate(PatientBase):
    medical_history: MedicalHistoryBase | None = None
    dental_history: DentalHistoryBase | None = None

    @model_validator(mode="after")
    def _ensure_name_fields(self):
        fn = (self.first_name or "").strip()
        ln = (self.last_name or "").strip()
        full = (self.full_name or "").strip()
        if not fn and full:
            fn, ln_from_full = _split_full_name(full)
            if not ln:
                ln = ln_from_full
        if not fn:
            raise ValueError("Either full_name or first_name is required")
        self.first_name = fn
        self.last_name = ln
        self.full_name = f"{fn} {ln}".strip()
        return self


class PatientUpdate(BaseModel):
    full_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    blood_group: str | None = None
    preferred_language: str | None = Field(default=None, pattern="^(en|hi|pa)$")
    doctor_id: int | None = None
    student_id: int | None = None
    cr_number: str | None = None
    disease_categories: list[str] | None = None
    case_keywords: list[str] | None = None
    special_case_flag: bool | None = None
    pain_scale: int | None = Field(default=None, ge=0, le=10)
    severity_level: str | None = Field(default=None, pattern="^(none|mild|moderate|severe|critical)$")
    parent_consent_required: bool | None = None
    parent_guardian_name: str | None = None
    parent_guardian_phone: str | None = None
    parent_consent_status: str | None = None
    card_verification_status: str | None = None
    tracker_stage: str | None = None
    source_channel: str | None = None
    medical_history: MedicalHistoryBase | None = None
    dental_history: DentalHistoryBase | None = None


class PatientSeverityUpdate(BaseModel):
    pain_scale: int = Field(ge=0, le=10)
    severity_level: str = Field(pattern="^(none|mild|moderate|severe|critical)$")


class PatientListItem(PatientBase):
    id: int
    patient_code: str
    full_name: str | None = None
    patient_name: str | None = None
    doctor_name: str | None = None
    student_name: str | None = None
    patient_card_document: str | None = None
    account_status: str = "active"
    attendance_status: str = "not_arrived"
    age: int | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PatientDetailResponse(PatientBase):
    id: int
    patient_code: str
    full_name: str | None = None
    patient_name: str | None = None
    doctor_name: str | None = None
    student_name: str | None = None
    patient_card_document: str | None = None
    account_status: str = "active"
    attendance_status: str = "not_arrived"
    last_attendance_at: datetime | None = None
    age: int | None = None
    created_at: datetime
    updated_at: datetime
    medical_history_json: dict[str, Any] = {}
    dental_history_json: dict[str, Any] = {}
    misc_records_json: dict[str, Any] = {}
    patient_shared_notices_json: list[dict[str, Any]] = []
    medical_history: MedicalHistoryResponse | None = None
    dental_history: DentalHistoryResponse | None = None
    model_config = ConfigDict(from_attributes=True)


def _normalize_tooth_numbers(raw: Any) -> list[int]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [int(x.strip()) for x in raw.split(",") if x.strip().isdigit()]
    if isinstance(raw, list):
        out: list[int] = []
        for item in raw:
            if isinstance(item, int):
                out.append(item)
            elif isinstance(item, str) and item.strip().isdigit():
                out.append(int(item.strip()))
        return out
    return []


class SurgicalLogCreate(BaseModel):
    procedure_name: str = Field(min_length=1, max_length=255)
    record_date: date | None = None
    surgery_date: date | None = None
    title: str | None = None
    tooth_numbers: list[int] | list[str] | str | None = []
    surgeon_name: str | None = None
    anesthesia_type: str | None = None
    operative_notes: str | None = None
    post_op_instructions: str | None = None
    suture_removal_date: date | None = None
    linked_document_ids: list[int] = []
    status: str = "completed"
    doctor_id: int | None = None

    @model_validator(mode="after")
    def _coerce_teeth(self):
        self.tooth_numbers = _normalize_tooth_numbers(self.tooth_numbers)
        return self


class SurgicalLogUpdate(BaseModel):
    procedure_name: str | None = None
    record_date: date | None = None
    surgery_date: date | None = None
    title: str | None = None
    tooth_numbers: list[int] | list[str] | str | None = None
    surgeon_name: str | None = None
    anesthesia_type: str | None = None
    operative_notes: str | None = None
    post_op_instructions: str | None = None
    suture_removal_date: date | None = None
    linked_document_ids: list[int] | None = None
    status: str | None = None

    @model_validator(mode="after")
    def _coerce_teeth(self):
        if self.tooth_numbers is not None:
            self.tooth_numbers = _normalize_tooth_numbers(self.tooth_numbers)
        return self


class SurgicalLogResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int | None = None
    student_id: int | None = None
    record_date: date
    surgery_date: date
    title: str
    status: str
    procedure_name: str
    tooth_numbers: list[int] = []
    surgeon_name: str | None = None
    anesthesia_type: str | None = None
    operative_notes: str | None = None
    post_op_instructions: str | None = None
    suture_removal_date: str | None = None
    linked_document_ids: list[int] = []
    is_visible_to_patient: bool = False
    created_at: datetime
    updated_at: datetime


class MiscRecordsUpdate(BaseModel):
    records: dict[str, Any] | None = None
    misc_records_json: dict[str, Any] | None = None
    category: str | None = None
    notes: Any | None = None


class SharedNoticeCreate(BaseModel):
    category: str | None = None
    notice_type: str | None = None
    title: str = Field(min_length=1, max_length=255)
    message: str | None = None
    description: str | None = None
    due_date: str | None = None
    target_date: str | None = None
    language: str = Field(default="en", pattern="^(en|hi|pa)$")

    @model_validator(mode="after")
    def _normalize_notice(self):
        if not self.category:
            self.category = self.notice_type or "scan_request"
        if not self.notice_type:
            self.notice_type = self.category
        if not self.message:
            self.message = (self.description or self.title).strip()
        return self


class SharedNoticeResponse(BaseModel):
    id: str
    category: str
    notice_type: str | None = None
    title: str
    message: str
    description: str | None = None
    due_date: str | None = None
    target_date: str | None = None
    language: str = "en"
    created_by: str | None = None
    created_at: str
