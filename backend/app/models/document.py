from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    clinical_record_id = Column(Integer, ForeignKey("clinical_records.id", ondelete="SET NULL"), nullable=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    document_type = Column(String(50), index=True, nullable=False)
    title = Column(String(255), nullable=False, default="")
    description = Column(Text, nullable=True)
    disease_category = Column(String(150), index=True, nullable=True)
    treatment_stage = Column(String(50), nullable=False, default="initial_assessment")
    media_date = Column(Date, index=True, nullable=False, default=date.today)
    is_shared_with_patient = Column(Boolean, default=False, nullable=False)
    storage_key = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(150), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    is_encrypted = Column(Boolean, default=True, nullable=False)
    encryption_iv = Column(String(100), nullable=True)
    sha256_checksum = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="documents", foreign_keys=[patient_id])
    clinical_record = relationship("ClinicalRecord", foreign_keys=[clinical_record_id])
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_user_id])

    @property
    def file_name(self) -> str:
        return Path(self.storage_key).name if self.storage_key else self.original_filename

    @property
    def original_file_name(self) -> str:
        return self.original_filename

    @property
    def file_size(self) -> int:
        return int(self.file_size_bytes or 0)

    @property
    def notes(self) -> str | None:
        return self.description

    @property
    def visit_id(self) -> int | None:
        return self.clinical_record_id
