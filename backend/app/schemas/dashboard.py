from typing import Any

from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_patients: int
    new_patients_period: int
    today_appointments: int
    upcoming_appointments: int
    pending_treatments: int
    completed_treatments: int
    followups_due: int


class StatusCount(BaseModel):
    status: str
    count: int


class ProcedureCount(BaseModel):
    procedure_name: str
    count: int


class PatientTrendPoint(BaseModel):
    date: str
    new_patients: int


class DashboardAnalyticsResponse(BaseModel):
    appointments_by_status: list[StatusCount]
    treatments_by_procedure: list[ProcedureCount]
    patients_trend: list[PatientTrendPoint]


class DoctorPatientCount(BaseModel):
    doctor_id: int
    doctor_name: str
    specialization: str
    department: str = "Oral Health Sciences"
    cabin_operatory: str = "Operatory 1"
    is_admin: bool = False
    students_count: int
    patient_count: int


class StudentPatientCount(BaseModel):
    student_id: int
    student_name: str
    doctor_name: str
    roll_number: str
    enrollment_number: str
    patient_count: int


class RecentRegistrationItem(BaseModel):
    entity_type: str
    id: int
    name: str
    code_or_email: str
    created_at: str


class AdminDashboardResponse(BaseModel):
    total_doctors: int
    total_students: int
    total_patients: int
    doctor_patient_counts: list[DoctorPatientCount]
    student_patient_counts: list[StudentPatientCount]
    recent_registrations: list[RecentRegistrationItem]


class DoctorDashboardResponse(BaseModel):
    doctor_id: int
    doctor_name: str
    total_students: int
    total_patients: int
    all_patients_count: int
    my_patients_count: int
    patients_registered_directly: int
    patients_assigned_to_students: int
    pending_followups: int
    students: list[dict[str, Any]]
    recent_patients: list[dict[str, Any]]
    pending_followups_list: list[dict[str, Any]]
    missed_appointments: list[dict[str, Any]]
    high_severity_patients: list[dict[str, Any]]


class StudentDashboardResponse(BaseModel):
    student_id: int
    student_name: str
    doctor_name: str
    my_patients_count: int
    pending_records: int
    upcoming_appointments: int
    my_patients: list[dict[str, Any]]
    recent_patients: list[dict[str, Any]]
    upcoming_appointments_list: list[dict[str, Any]]
