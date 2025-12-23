# Simple HTTP server for testing
Write-Host "Starting local web server..." -ForegroundColor Green
Write-Host ""
Write-Host "Open your browser and go to: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Try Python first, then fallback to Node.js
if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server 8000
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -m http.server 8000
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    npx http-server -p 8000
} else {
    Write-Host "Error: Python or Node.js required to run local server" -ForegroundColor Red
    Write-Host "Or open index.html directly in your browser" -ForegroundColor Yellow
}

