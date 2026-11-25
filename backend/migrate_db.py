import sys
from pathlib import Path

from sqlalchemy import inspect

# Ensure backend directory is on sys.path regardless of working directory
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.models  # noqa: E402, F401
from app.database import Base, engine  # noqa: E402

EXPECTED_TABLES = {
    "appointments",
    "care_and_system_logs",
    "clinical_records",
    "doctors",
    "documents",
    "patients",
    "students",
    "users",
}


def run_migration() -> list[str]:
    """Create and verify the portable 8-table PGI schema (SQLite & MySQL 8.0 compatible)."""
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    tables = sorted(inspector.get_table_names())
    missing = EXPECTED_TABLES - set(tables)
    if missing:
        raise RuntimeError(f"Schema migration incomplete; missing tables: {sorted(missing)}")
    print(f"Database schema verified ({len(tables)} tables): {tables}")
    return tables


if __name__ == "__main__":
    run_migration()
