from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator


class ProcedureCatalogResponse(BaseModel):
    id: int
    code: str
    name: str
    category: str
    description: str | None = None


class TreatmentItemCreate(BaseModel):
    procedure_name: str
    tooth_number: int | None = None
    notes: str | None = None


class TreatmentItemUpdate(BaseModel):
    procedure_name: str | None = None
    tooth_number: int | None = None
    status: str | None = None
    visit_id: int | None = None
    notes: str | None = None


class TreatmentItemResponse(BaseModel):
    id: str | int
    treatment_plan_id: int
    procedure_name: str
    tooth_number: int | None = None
    status: str
    visit_id: int | None = None
    notes: str | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class TreatmentPlanCreate(BaseModel):
    patient_id: int
    doctor_id: int | None = None
    dentist_id: int | None = None
    title: str
    notes: str | None = None
    treatments: list[TreatmentItemCreate] = []

    @model_validator(mode="after")
    def _normalize_doctor(self):
        if self.doctor_id is None and self.dentist_id is not None:
            self.doctor_id = self.dentist_id
        return self


class TreatmentPlanUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    notes: str | None = None


class TreatmentPlanResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int | None = None
    dentist_id: int | None = None
    title: str
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    doctor_name: str | None = None
    dentist_name: str | None = None
    patient_name: str | None = None
    treatments: list[TreatmentItemResponse] = []
    model_config = ConfigDict(from_attributes=True)
