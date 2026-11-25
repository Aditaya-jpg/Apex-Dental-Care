from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MedicineCatalogResponse(BaseModel):
    id: int
    name: str
    generic_name: str | None = None
    dosage_form: str
    default_dosage: str | None = None
    instructions: str | None = None


class PrescriptionItemCreate(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    timing: str = "After Food"
    instructions: str | None = None
    localized_instructions: str | None = None


class PrescriptionItemResponse(PrescriptionItemCreate):
    id: int | str
    prescription_id: int | None = None


class PrescriptionCreate(BaseModel):
    patient_id: int
    doctor_id: int | None = None
    dentist_id: int | None = None
    visit_id: int | None = None
    diagnosis_summary: str | None = None
    general_instructions: str | None = None
    treatment_instructions: str | None = None
    template_name: str | None = None
    language: str = Field(default="en", pattern="^(en|hi|pa)$")
    is_visible_to_patient: bool = True
    items: list[PrescriptionItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def _normalize_doctor(self):
        if self.doctor_id is None and self.dentist_id is not None:
            self.doctor_id = self.dentist_id
        return self


class PrescriptionResponse(BaseModel):
    id: int
    prescription_number: str
    patient_id: int
    doctor_id: int | None = None
    dentist_id: int | None = None
    visit_id: int | None = None
    diagnosis_summary: str | None = None
    general_instructions: str | None = None
    treatment_instructions: str | None = None
    localized_summary: str | None = None
    template_name: str | None = None
    language: str = "en"
    is_visible_to_patient: bool = True
    created_at: datetime
    doctor_name: str | None = None
    dentist_name: str | None = None
    patient_name: str | None = None
    items: list[PrescriptionItemResponse] = []
    model_config = ConfigDict(from_attributes=True)
