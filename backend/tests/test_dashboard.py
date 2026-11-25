def test_dashboard_summary_metrics(client, admin_token):
    res = client.get("/api/v1/dashboard/summary?period=30d", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_patients"] >= 16
    assert "today_appointments" in data
    assert "pending_treatments" in data
    assert "total_revenue" not in data
    assert "outstanding_payments" not in data


def test_dashboard_analytics_charts(client, admin_token):
    res = client.get("/api/v1/dashboard/analytics?days=30", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "appointments_by_status" in data
    assert len(data["appointments_by_status"]) > 0
    assert "treatments_by_procedure" in data
    assert "revenue_trend" not in data
    assert "patients_trend" in data


def test_admin_doctor_student_dashboards(client, admin_token, doctor_token, student1_token):
    adm = client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert adm.status_code == 200
    adm_data = adm.json()
    assert adm_data["total_doctors"] >= 3
    assert adm_data["total_students"] >= 6
    assert adm_data["total_patients"] >= 16
    assert len(adm_data["doctor_patient_counts"]) >= 3
    assert "students_count" in adm_data["doctor_patient_counts"][0]

    doc = client.get("/api/v1/dashboard/doctor", headers={"Authorization": f"Bearer {doctor_token}"})
    assert doc.status_code == 200
    doc_data = doc.json()
    assert doc_data["all_patients_count"] >= 16
    assert doc_data["total_patients"] == doc_data["all_patients_count"]
    assert isinstance(doc_data["pending_followups"], int)
    assert len(doc_data["missed_appointments"]) >= 2
    assert len(doc_data["high_severity_patients"]) >= 1
    assert len(doc_data["students"]) >= 6

    stu = client.get("/api/v1/dashboard/student", headers={"Authorization": f"Bearer {student1_token}"})
    assert stu.status_code == 200
    stu_data = stu.json()
    assert stu_data["my_patients_count"] == 5
    assert isinstance(stu_data["pending_records"], int)
    assert isinstance(stu_data["upcoming_appointments"], int)


def test_health_endpoints(client):
    liveness = client.get("/health")
    assert liveness.status_code == 200
    assert liveness.json()["status"] == "ok"

    readiness = client.get("/health/ready")
    assert readiness.status_code == 200
    assert readiness.json()["status"] == "ready"
