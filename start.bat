@echo off
echo ========================================
echo Starting NXSYS AI CHAT Application
echo ========================================
echo.
echo Features:
echo - Email OTP Authentication
echo - Password Reset via Email
echo - File Search with AI
echo ========================================
echo.

REM Start Backend Server in new window
echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d %~dp0backend && python app.py"

REM Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

REM Start Frontend Server in new window
echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo Both servers are starting...
echo ========================================
echo Backend API: http://localhost:5000
echo Frontend: Will open automatically in browser
echo.
echo Email Configuration: O365 SMTP (nxsys_ai@nxsys.com)
echo ========================================
echo.
echo Waiting 10 seconds for servers to initialize...
timeout /t 10 /nobreak

echo.
echo ========================================
echo Opening browser...
echo ========================================
echo.
echo If the page doesn't load:
echo 1. Check the "Frontend Server" window
echo 2. Look for: "Local: http://localhost:XXXX/"
echo 3. Open that URL manually in your browser
echo.
echo TIP: Test the password reset feature!
echo      Click "Forgot Password?" on the login page
echo ========================================
echo.
echo Press any key to open browser...
pause >nul

REM Try common ports
start http://localhost:5173 2>nul || start http://localhost:3001

echo.
echo ========================================
echo   APPLICATION IS RUNNING!
echo ========================================
echo.
echo What you can do:
echo - Login with your credentials
echo - Test "Forgot Password?" feature
echo - Upload files and chat with AI
echo - Verify email with OTP codes
echo.
echo To stop: Close the Backend and Frontend windows
echo ========================================
echo.
pause
