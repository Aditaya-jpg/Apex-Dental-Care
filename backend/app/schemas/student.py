from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class StudentCreate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    student_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: str | None = None
    phone_number: str | None = None
    college_institution: str = Field(default="PGI Oral Health Sciences Centre", min_length=2, max_length=255)
    roll_number: str | None = Field(default=None, min_length=2, max_length=100)
    enrollment_number: str | None = Field(default=None, min_length=2, max_length=100)
    year_of_study: str | None = None
    department: str | None = None
    doctor_id: int | None = None  # Optional / flexible branch pool
    is_active: bool | None = None
    account_status: str = "active"

    @model_validator(mode="after")
    def _normalize_aliases(self):
        if not self.full_name and self.student_name:
            self.full_name = self.student_name
        if not self.full_name:
            raise ValueError("full_name or student_name is required")
        if not self.roll_number and self.enrollment_number:
            self.roll_number = self.enrollment_number
        if not self.roll_number:
            raise ValueError("roll_number or enrollment_number is required")
        if self.phone is None and self.phone_number is not None:
            self.phone = self.phone_number
        if self.is_active is None:
            self.is_active = self.account_status == "active"
        return self


class StudentUpdate(BaseModel):
    full_name: str | None = None
    student_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    phone_number: str | None = None
    college_institution: str | None = None
    roll_number: str | None = None
    enrollment_number: str | None = None
    year_of_study: str | None = None
    department: str | None = None
    doctor_id: int | None = None
    password: str | None = None
    is_active: bool | None = None
    account_status: str | None = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    doctor_id: int | None = None
    doctor_name: str | None = None
    full_name: str
    student_name: str
    email: str
    phone: str | None = None
    phone_number: str | None = None
    roll_number: str
    enrollment_number: str
    year_of_study: str | None = None
    department: str | None = None
    college_institution: str
    is_active: bool = True
    account_status: str
    revoked_at: datetime | None = None
    created_at: datetime
    patients_count: int = 0
