"""pgi_8_table_schema

Revision ID: 001_pgi_8_table_schema
Revises:
Create Date: 2026-11-25 15:00:00.000000

Portable 8-table schema for PGI Dental Management System (SQLite & MySQL 8.0).
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_pgi_8_table_schema"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create strictly 8 normalized tables (3 Core + 5 Supporting)."""
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="patient"),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("refresh_tokens_json", sa.JSON(), nullable=False),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    # 2. doctors (Core 1)
    op.create_table(
        "doctors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("specialization", sa.String(length=150), nullable=False, server_default="General Dentistry"),
        sa.Column("department", sa.String(length=150), nullable=False, server_default="Oral Health Sciences"),
        sa.Column("license_number", sa.String(length=100), nullable=False),
        sa.Column("cabin_operatory", sa.String(length=100), nullable=False, server_default="Operatory 1"),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("google_calendar_id", sa.String(length=255), nullable=True),
        sa.Column("google_oauth_tokens", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("license_number"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_doctors_id"), "doctors", ["id"], unique=False)
    op.create_index(op.f("ix_doctors_email"), "doctors", ["email"], unique=True)

    # 3. students (Core 2)
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("doctor_id", sa.Integer(), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("roll_number", sa.String(length=100), nullable=False),
        sa.Column("year_of_study", sa.String(length=50), nullable=True),
        sa.Column("department", sa.String(length=150), nullable=True),
        sa.Column("college_institution", sa.String(length=255), nullable=False, server_default="PGI Oral Health Sciences Centre"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("roll_number"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_students_id"), "students", ["id"], unique=False)
    op.create_index(op.f("ix_students_email"), "students", ["email"], unique=True)
    op.create_index(op.f("ix_students_doctor_id"), "students", ["doctor_id"], unique=False)

    # 4. patients (Core 3)
    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("doctor_id", sa.Integer(), nullable=True),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("patient_code", sa.String(length=50), nullable=False),
        sa.Column("cr_number", sa.String(length=100), nullable=True),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("gender", sa.String(length=20), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("blood_group", sa.String(length=10), nullable=True),
        sa.Column("emergency_contact_name", sa.String(length=150), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(length=50), nullable=True),
        sa.Column("preferred_language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("disease_categories", sa.JSON(), nullable=False),
        sa.Column("case_keywords", sa.JSON(), nullable=False),
        sa.Column("special_case_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pain_scale", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("severity_level", sa.String(length=30), nullable=False, server_default="none"),
        sa.Column("parent_consent_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("parent_guardian_name", sa.String(length=150), nullable=True),
        sa.Column("parent_guardian_phone", sa.String(length=50), nullable=True),
        sa.Column("parent_consent_status", sa.String(length=30), nullable=False, server_default="not_required"),
        sa.Column("parent_consent_doc_id", sa.Integer(), nullable=True),
        sa.Column("card_doc_id", sa.Integer(), nullable=True),
        sa.Column("card_verification_status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("medical_history_json", sa.JSON(), nullable=False),
        sa.Column("dental_history_json", sa.JSON(), nullable=False),
        sa.Column("dental_chart_json", sa.JSON(), nullable=False),
        sa.Column("perio_chart_json", sa.JSON(), nullable=False),
        sa.Column("misc_records_json", sa.JSON(), nullable=False),
        sa.Column("patient_shared_notices_json", sa.JSON(), nullable=False),
        sa.Column("attendance_status", sa.String(length=30), nullable=False, server_default="not_arrived"),
        sa.Column("last_attendance_at", sa.DateTime(), nullable=True),
        sa.Column("tracker_stage", sa.String(length=30), nullable=False, server_default="registered"),
        sa.Column("source_channel", sa.String(length=50), nullable=False, server_default="walk_in"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_patients_id"), "patients", ["id"], unique=False)
    op.create_index(op.f("ix_patients_patient_code"), "patients", ["patient_code"], unique=True)
    op.create_index(op.f("ix_patients_cr_number"), "patients", ["cr_number"], unique=True)
    op.create_index(op.f("ix_patients_first_name"), "patients", ["first_name"], unique=False)
    op.create_index(op.f("ix_patients_last_name"), "patients", ["last_name"], unique=False)
    op.create_index(op.f("ix_patients_phone"), "patients", ["phone"], unique=False)
    op.create_index(op.f("ix_patients_doctor_id"), "patients", ["doctor_id"], unique=False)
    op.create_index(op.f("ix_patients_student_id"), "patients", ["student_id"], unique=False)
    op.create_index(op.f("ix_patients_is_deleted"), "patients", ["is_deleted"], unique=False)

    # 5. appointments
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("operatory", sa.String(length=100), nullable=False, server_default="Operatory 1"),
        sa.Column("appointment_type", sa.String(length=150), nullable=False, server_default="Routine Checkup & Consultation"),
        sa.Column("appointment_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="scheduled"),
        sa.Column("attendance_status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("attendance_marked_at", sa.DateTime(), nullable=True),
        sa.Column("attendance_marked_by", sa.Integer(), nullable=True),
        sa.Column("is_missed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("missed_reason", sa.Text(), nullable=True),
        sa.Column("google_event_id", sa.String(length=255), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("cancellation_reason", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_appointments_id"), "appointments", ["id"], unique=False)
    op.create_index(op.f("ix_appointments_patient_id"), "appointments", ["patient_id"], unique=False)
    op.create_index(op.f("ix_appointments_doctor_id"), "appointments", ["doctor_id"], unique=False)
    op.create_index(op.f("ix_appointments_operatory"), "appointments", ["operatory"], unique=False)
    op.create_index(op.f("ix_appointments_appointment_date"), "appointments", ["appointment_date"], unique=False)
    op.create_index(op.f("ix_appointments_status"), "appointments", ["status"], unique=False)

    # 6. clinical_records
    op.create_table(
        "clinical_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=True),
        sa.Column("doctor_id", sa.Integer(), nullable=True),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("appointment_id", sa.Integer(), nullable=True),
        sa.Column("record_type", sa.String(length=50), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("is_visible_to_patient", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_clinical_records_id"), "clinical_records", ["id"], unique=False)
    op.create_index(op.f("ix_clinical_records_patient_id"), "clinical_records", ["patient_id"], unique=False)
    op.create_index(op.f("ix_clinical_records_record_type"), "clinical_records", ["record_type"], unique=False)
    op.create_index(op.f("ix_clinical_records_record_date"), "clinical_records", ["record_date"], unique=False)

    # 7. documents
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("clinical_record_id", sa.Integer(), nullable=True),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("disease_category", sa.String(length=150), nullable=True),
        sa.Column("treatment_stage", sa.String(length=50), nullable=False, server_default="initial_assessment"),
        sa.Column("media_date", sa.Date(), nullable=False),
        sa.Column("is_shared_with_patient", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=150), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("is_encrypted", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("encryption_iv", sa.String(length=100), nullable=True),
        sa.Column("sha256_checksum", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["clinical_record_id"], ["clinical_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)
    op.create_index(op.f("ix_documents_patient_id"), "documents", ["patient_id"], unique=False)
    op.create_index(op.f("ix_documents_document_type"), "documents", ["document_type"], unique=False)
    op.create_index(op.f("ix_documents_disease_category"), "documents", ["disease_category"], unique=False)
    op.create_index(op.f("ix_documents_media_date"), "documents", ["media_date"], unique=False)

    # 8. care_and_system_logs
    op.create_table(
        "care_and_system_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("assigned_doctor_id", sa.Integer(), nullable=True),
        sa.Column("assigned_student_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="open"),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("channel", sa.String(length=50), nullable=False, server_default="system"),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_student_id"], ["students.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_care_and_system_logs_id"), "care_and_system_logs", ["id"], unique=False)
    op.create_index(op.f("ix_care_and_system_logs_event_type"), "care_and_system_logs", ["event_type"], unique=False)
    op.create_index(op.f("ix_care_and_system_logs_patient_id"), "care_and_system_logs", ["patient_id"], unique=False)
    op.create_index(op.f("ix_care_and_system_logs_status"), "care_and_system_logs", ["status"], unique=False)
    op.create_index(op.f("ix_care_and_system_logs_scheduled_date"), "care_and_system_logs", ["scheduled_date"], unique=False)


def downgrade() -> None:
    """Drop all 8 tables in reverse dependency order."""
    op.drop_table("care_and_system_logs")
    op.drop_table("documents")
    op.drop_table("clinical_records")
    op.drop_table("appointments")
    op.drop_table("patients")
    op.drop_table("students")
    op.drop_table("doctors")
    op.drop_table("users")
