from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FollowUpBase(BaseModel):
    patient_id: int
    doctor_id: int | None = None
    dentist_id: int | None = None
    visit_id: int | None = None
    scheduled_date: date
    reason: str
    notes: str | None = None

    @model_validator(mode="after")
    def _normalize_doctor(self):
        if self.doctor_id is None and self.dentist_id is not None:
            self.doctor_id = self.dentist_id
        return self


class FollowUpCreate(FollowUpBase):
    pass


class FollowUpUpdate(BaseModel):
    scheduled_date: date | None = None
    reason: str | None = None
    status: str | None = Field(default=None, pattern="^(pending|completed|cancelled)$")
    notes: str | None = None


class FollowUpResponse(FollowUpBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    patient_name: str | None = None
    doctor_name: str | None = None
    dentist_name: str | None = None
    model_config = ConfigDict(from_attributes=True)
