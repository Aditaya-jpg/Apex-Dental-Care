# PGI Dental Management System – Product Requirements

## 1. General & Platform Requirements

* **Multi-Device Access:** Simultaneous access across computers, tablets, and mobile devices.

* **No Payment Module:** Billing and payment features are explicitly excluded.

* **Language Support:** Hindi, English, and Punjabi support for prescriptions, treatment instructions, and appointment reminders.

## 2. User Roles & Role-Based Access Control (RBAC)

* **Admin (Faculty / Designated Doctor):**

  * Add, update, and manage Doctors.

  * Add, update, and delete Students.

* **Doctors:**

  * Register, add, and delete Students under them (changes reflected on a single Students table).

  * Add Patients.

  * View all patient records and information.

  * Add missed patients and update patient pain/severity levels.

* **Students:**

  * Add Patients (as permitted).

  * Access and manage assigned patient records.

* **Receptionist:**

  * Mark and manage patient attendance only.

## 3. Patient Registration & Categorization

* **Registration Details:** Upload patient card or enter details such as CR Number.

* **Consent:** Record/upload parent's consent (for minors/special cases).

* **Category-Wise Segregation:**

  * Multi-select checkboxes for disease categories (a single patient can belong to multiple categories).

  * Keyword-based case segregation (e.g., age, special cases).

* **Patient Tracker:** Track telephonic enquiries and patients slipping through at various stages.

## 4. Electronic Medical Records (EMR)

On selecting a patient, the profile must include:

* **Demographic Details** *(Priority field)*

* **History of Illness / Patient History**

* **Examinations:** General examination and Intraoral examination.

* **Clinical Notes & Severity:** Pain scale with adjustable severity levels.

* **Dental Charting:** Restorative charting and Perio charting.

* **Diagnosis & Treatment Plans:** Planned treatments and date-wise surgical treatment logs.

* **Prescriptions (Separate Section):** Auto-prescriptions, templates, and localized instructions.

* **Treatment Instructions:** Standardized and localized instructions.

* **Follow-ups:** Follow-up tracking and history.

* **Miscellaneous:** Category-specific miscellaneous records.

## 5. Media & Imaging Storage

* **Imaging Types:** X-rays, OPG, and CBCT storage.

* **Photography Types:** Intraoral, Extraoral, IOP, Profile photos, Surgery photographs, and Miscellaneous photos.

* **Organization:**

  * All media stored **date-wise** and across **different stages of treatment**.

  * Hyperlinks under disease categories pointing directly to date-wise X-rays.

## 6. Appointments & Front Office Management

* **Smart Calendar:** Doctor-wise and Operatory-wise calendar views.

* **Google Calendar Integration:** Sync appointments for both doctors and patients.

* **Missed Appointments:** Track and add missed appointments/patients directly from the Doctor page.

## 7. Patient Care, Notifications & Integrations

* **SMS & Email Alerts:** Automated notifications for appointment confirmations, changes, and cancellations (with custom SMS sender ID).

* **Automated Instructions:** Pre-appointment and post-treatment instructions.

* **Automatic Recalls:**

  * Regular check-up recalls.

  * Treatment-specific recalls.

* **Preventive Care Messaging:** Automated messages based on demographic factors, medical/dental conditions, and habits.

* **Social Media Integration:** Integration with social media platforms.

## 8. Database Constraints (High-Level)

* **Minimal Tables:** Keep the database schema lightweight with 3 primary tables:

  1. `Doctors`

  2. `Students` (linked to `Doctors` via Foreign Key)

  3. `Patients` (linked to assigned `Doctor` or `Student` ID via Foreign Key)