from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class VisitBase(BaseModel):
    patient_id: int
    doctor_id: int | None = None
    dentist_id: int | None = None
    appointment_id: int | None = None
    visit_date: date
    vitals_blood_pressure: str | None = None
    vitals_pulse: int | None = None
    chief_complaint: str | None = None
    general_exam_notes: str | None = None
    extraoral_findings: str | None = None
    tmj_status: str | None = None
    lymph_nodes: str | None = None
    intraoral_hard_tissue: str | None = None
    intraoral_soft_tissue: str | None = None
    occlusion_status: str | None = None
    oral_findings: str | None = None
    gum_condition: str | None = None
    hygiene_index: str | None = None
    diagnosis: str | None = None
    clinical_notes: str | None = None
    pain_scale: int | None = Field(default=None, ge=0, le=10)
    severity_level: str | None = Field(default=None, pattern="^(none|mild|moderate|severe|critical)$")

    @model_validator(mode="after")
    def _normalize_doctor(self):
        if self.doctor_id is None and self.dentist_id is not None:
            self.doctor_id = self.dentist_id
        return self


class VisitCreate(VisitBase):
    pass


class VisitUpdate(BaseModel):
    vitals_blood_pressure: str | None = None
    vitals_pulse: int | None = None
    chief_complaint: str | None = None
    general_exam_notes: str | None = None
    extraoral_findings: str | None = None
    tmj_status: str | None = None
    lymph_nodes: str | None = None
    intraoral_hard_tissue: str | None = None
    intraoral_soft_tissue: str | None = None
    occlusion_status: str | None = None
    oral_findings: str | None = None
    gum_condition: str | None = None
    hygiene_index: str | None = None
    diagnosis: str | None = None
    clinical_notes: str | None = None
    pain_scale: int | None = Field(default=None, ge=0, le=10)
    severity_level: str | None = Field(default=None, pattern="^(none|mild|moderate|severe|critical)$")


class VisitResponse(VisitBase):
    id: int
    created_at: datetime
    doctor_name: str | None = None
    dentist_name: str | None = None
    patient_name: str | None = None
    model_config = ConfigDict(from_attributes=True)
