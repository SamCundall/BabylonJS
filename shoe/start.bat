@echo off
title Shoe Customizer - Local Server
echo ========================================
echo   Shoe Customizer - Starting Server...
echo ========================================
echo.

:: Try Python 3 first
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Found Python. Starting server on http://localhost:8000
    echo.
    echo Press Ctrl+C to stop the server.
    echo.
    start "" http://localhost:8000
    python -m http.server 8000
    goto :end
)

:: Try Python via py launcher
where py >nul 2>nul
if %errorlevel% equ 0 (
    echo Found Python (py). Starting server on http://localhost:8000
    echo.
    start "" http://localhost:8000
    py -m http.server 8000
    goto :end
)

:: Try npx serve
where npx >nul 2>nul
if %errorlevel% equ 0 (
    echo Found Node.js. Starting server on http://localhost:3000
    echo.
    start "" http://localhost:3000
    npx serve -l 3000
    goto :end
)

echo ERROR: No suitable server found.
echo Please install Python (python.org) or Node.js (nodejs.org)
echo.
pause

:end
