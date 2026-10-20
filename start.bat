@echo off
echo ===================================================
echo Starting Apex Dental Care Web Application...
echo ===================================================

:: Start Oral-3D AI Reconstruction Engine in a new window
start "Oral-3D AI Reconstruction Engine (Port 8001)" cmd /k "cd /d %~dp0.. && python app.py --port 8001"

:: Start Backend Server in a new window
start "Apex Dental Backend (FastAPI)" cmd /k "cd /d %~dp0backend && venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000"

:: Start Frontend Server in a new window
start "Apex Dental Frontend (Vite/React)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Oral-3D Engine at:  http://127.0.0.1:8001
echo Backend running at: http://127.0.0.1:8000
echo Frontend running at: http://localhost:3000
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:3000
