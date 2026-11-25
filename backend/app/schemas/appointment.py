from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AppointmentTypeResponse(BaseModel):
    id: int
    name: str
    duration_minutes: int
    color_code: str


class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: int | None = None
    dentist_id: int | None = None
    student_id: int | None = None
    operatory: str = "Operatory 1"
    appointment_type: str = "Routine Checkup & Consultation"
    appointment_date: date
    start_time: time
    end_time: time
    reason: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _normalize_doctor(self):
        if self.doctor_id is None and self.dentist_id is not None:
            self.doctor_id = self.dentist_id
        return self


class AppointmentCreate(AppointmentBase):
    @model_validator(mode="after")
    def _require_doctor(self):
        if self.doctor_id is None:
            raise ValueError("doctor_id (or dentist_id) is required")
        return self


class AppointmentUpdate(BaseModel):
    doctor_id: int | None = None
    dentist_id: int | None = None
    student_id: int | None = None
    operatory: str | None = None
    appointment_type: str | None = None
    appointment_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: str | None = None
    reason: str | None = None
    cancellation_reason: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _normalize_doctor(self):
        if self.doctor_id is None and self.dentist_id is not None:
            self.doctor_id = self.dentist_id
        return self


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(scheduled|confirmed|checked_in|in_treatment|in_progress|completed|cancelled|no_show)$"
    )
    cancellation_reason: str | None = None


class AppointmentMissedCreate(BaseModel):
    patient_id: int | None = None
    cr_number: str | None = None
    doctor_id: int | None = None
    operatory: str = "Operatory 1"
    appointment_date: date | None = None
    missed_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    missed_reason: str | None = None
    reason: str | None = None
    notes: str | None = None
    send_recall: bool = False

    @model_validator(mode="after")
    def _normalize_reason(self):
        if not self.missed_reason:
            self.missed_reason = self.reason or self.notes or "Patient missed scheduled appointment"
        if not self.appointment_date and self.missed_date:
            self.appointment_date = self.missed_date
        return self


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    dentist_id: int | None = None
    student_id: int | None = None
    operatory: str = "Operatory 1"
    appointment_type: str = "Routine Checkup & Consultation"
    appointment_date: date
    start_time: time
    end_time: time
    status: str
    attendance_status: str = "pending"
    attendance_marked_at: datetime | None = None
    is_missed: bool = False
    missed_reason: str | None = None
    google_event_id: str | None = None
    google_calendar_url: str | None = None
    ics_url: str | None = None
    reason: str | None = None
    cancellation_reason: str | None = None
    notes: str | None = None
    created_at: datetime
    patient_name: str | None = None
    patient_code: str | None = None
    cr_number: str | None = None
    doctor_name: str | None = None
    dentist_name: str | None = None
    student_name: str | None = None
    appointment_type_name: str | None = None
    model_config = ConfigDict(from_attributes=True)
