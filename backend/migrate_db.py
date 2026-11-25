import sqlite3
import os
import json
from pathlib import Path
from datetime import datetime, UTC

DB_PATH = Path(__file__).resolve().parent / "dental.db"

def run_migration():
    print(f"Applying database migration on {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Create 'doctors' table if not exists
    cur.execute("""
    CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(50),
        qualification VARCHAR(255),
        specialization VARCHAR(150) NOT NULL DEFAULT 'General Dentistry',
        registration_number VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        account_status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL,
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS ix_doctors_id ON doctors (id);")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_doctors_email ON doctors (email);")

    # 2. Create 'students' table if not exists
    cur.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(50),
        college_institution VARCHAR(255) NOT NULL,
        enrollment_number VARCHAR(100) UNIQUE NOT NULL,
        doctor_id INTEGER NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        account_status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL,
        user_id INTEGER,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS ix_students_id ON students (id);")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_students_email ON students (email);")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_students_doctor_id ON students (doctor_id);")

    # 3. Add columns to 'patients' table if not present
    patient_cols = [c[1] for c in cur.execute("PRAGMA table_info(patients)").fetchall()]
    new_patient_cols = [
        ("doctor_id", "INTEGER REFERENCES doctors(id) ON DELETE SET NULL"),
        ("student_id", "INTEGER REFERENCES students(id) ON DELETE SET NULL"),
        ("cr_number", "VARCHAR(100)"),
        ("disease_categories", "TEXT DEFAULT '[]'"),
        ("patient_card_document", "VARCHAR(500)"),
        ("card_verification_status", "VARCHAR(50) DEFAULT 'pending'"),
        ("account_status", "VARCHAR(50) DEFAULT 'active'"),
    ]
    for col_name, col_def in new_patient_cols:
        if col_name not in patient_cols:
            print(f"Adding column '{col_name}' to patients...")
            cur.execute(f"ALTER TABLE patients ADD COLUMN {col_name} {col_def};")

    cur.execute("CREATE INDEX IF NOT EXISTS ix_patients_doctor_id ON patients (doctor_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_patients_student_id ON patients (student_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_patients_cr_number ON patients (cr_number);")

    # 4. Add columns to 'users' table if not present
    user_cols = [c[1] for c in cur.execute("PRAGMA table_info(users)").fetchall()]
    new_user_cols = [
        ("doctor_id", "INTEGER REFERENCES doctors(id) ON DELETE SET NULL"),
        ("student_id", "INTEGER REFERENCES students(id) ON DELETE SET NULL"),
    ]
    for col_name, col_def in new_user_cols:
        if col_name not in user_cols:
            print(f"Adding column '{col_name}' to users...")
            cur.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def};")

    # 5. Populate existing dentists into 'doctors'
    dentists = cur.execute("""
        SELECT d.id, d.user_id, d.license_number, d.specialization, d.qualifications, u.email, u.full_name, u.phone, u.hashed_password, u.created_at, u.is_active
        FROM dentists d
        JOIN users u ON d.user_id = u.id
    """).fetchall()

    for d in dentists:
        d_id, u_id, lic, spec, qual, email, name, phone, pw_hash, created, is_act = d
        status = 'active' if is_act else 'inactive'
        # Check if already exists in doctors
        existing = cur.execute("SELECT id FROM doctors WHERE id = ? OR email = ?", (d_id, email)).fetchone()
        if not existing:
            print(f"Migrating dentist {name} ({email}) to doctors table...")
            cur.execute("""
                INSERT INTO doctors (id, doctor_name, email, phone_number, qualification, specialization, registration_number, password_hash, account_status, created_at, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (d_id, name, email, phone, qual, spec, lic, pw_hash, status, created or datetime.now(UTC), u_id))
        
        # Link user to doctor_id
        cur.execute("UPDATE users SET doctor_id = ? WHERE id = ?", (d_id, u_id))

    # 6. Assign existing patients to Doctor 1 (Dr. Marcus Chen) if doctor_id is NULL
    cur.execute("UPDATE patients SET doctor_id = 1 WHERE doctor_id IS NULL;")

    # 7. Generate CR numbers for existing patients where cr_number is NULL
    patients_without_cr = cur.execute("SELECT id, patient_code FROM patients WHERE cr_number IS NULL").fetchall()
    for pid, pcode in patients_without_cr:
        cr_num = f"CR-{1000 + pid}"
        cur.execute("UPDATE patients SET cr_number = ? WHERE id = ?", (cr_num, pid))

    conn.commit()
    conn.close()
    print("Database migration completed successfully!")

if __name__ == "__main__":
    run_migration()
