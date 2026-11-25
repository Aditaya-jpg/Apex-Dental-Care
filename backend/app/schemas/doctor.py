from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class DoctorCreate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    doctor_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: str | None = None
    phone_number: str | None = None
    department: str | None = None
    qualification: str | None = None
    specialization: str = "General Dentistry"
    license_number: str | None = Field(default=None, min_length=2, max_length=100)
    registration_number: str | None = Field(default=None, min_length=2, max_length=100)
    cabin_operatory: str = "Operatory 1"
    is_admin: bool = False
    is_active: bool | None = None
    account_status: str = "active"
    google_calendar_id: str | None = None

    @model_validator(mode="after")
    def _normalize_aliases(self):
        if not self.full_name and self.doctor_name:
            self.full_name = self.doctor_name
        if not self.full_name:
            raise ValueError("full_name or doctor_name is required")
        if not self.license_number and self.registration_number:
            self.license_number = self.registration_number
        if not self.license_number:
            raise ValueError("license_number or registration_number is required")
        if self.phone is None and self.phone_number is not None:
            self.phone = self.phone_number
        if self.department is None:
            self.department = self.qualification or "Oral Health Sciences"
        if self.is_active is None:
            self.is_active = self.account_status == "active"
        return self


class DoctorUpdate(BaseModel):
    full_name: str | None = None
    doctor_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    phone_number: str | None = None
    department: str | None = None
    qualification: str | None = None
    specialization: str | None = None
    license_number: str | None = None
    registration_number: str | None = None
    cabin_operatory: str | None = None
    is_admin: bool | None = None
    is_active: bool | None = None
    account_status: str | None = None
    google_calendar_id: str | None = None
    password: str | None = None


class DoctorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    full_name: str
    doctor_name: str
    email: str
    phone: str | None = None
    phone_number: str | None = None
    department: str
    qualification: str | None = None
    specialization: str
    license_number: str
    registration_number: str
    cabin_operatory: str = "Operatory 1"
    is_admin: bool = False
    google_calendar_id: str | None = None
    is_active: bool = True
    account_status: str
    created_at: datetime
    students_count: int = 0
    patients_count: int = 0
