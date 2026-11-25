from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StudentCreate(BaseModel):
    student_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone_number: str | None = None
    college_institution: str = Field(..., min_length=2, max_length=255)
    enrollment_number: str = Field(..., min_length=2, max_length=100)
    doctor_id: int | None = None  # Auto-populated if created by Doctor
    account_status: str = "active"


class StudentUpdate(BaseModel):
    student_name: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
    college_institution: str | None = None
    enrollment_number: str | None = None
    password: str | None = None
    account_status: str | None = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_name: str
    email: str
    phone_number: str | None = None
    college_institution: str
    enrollment_number: str
    doctor_id: int
    doctor_name: str | None = None
    account_status: str
    created_at: datetime
    patients_count: int = 0
