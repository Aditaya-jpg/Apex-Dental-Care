from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
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
    card_verification_status: str = "pending"
    tracker_stage: str = "registered"
    source_channel: str = "walk_in"


class PatientCreate(PatientBase):
    medical_history: MedicalHistoryBase | None = None
    dental_history: DentalHistoryBase | None = None


class PatientUpdate(BaseModel):
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
    card_doc_id: int | None = None
    parent_consent_doc_id: int | None = None
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
