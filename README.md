# 🌍 Air Quality Prediction System

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**AI-Powered Air Quality Monitoring & 24-Hour Prediction Platform with NASA Satellite Integration**

Real-time air quality monitoring system that combines Machine Learning, NASA satellite data, and weather APIs to predict AQI 24 hours in advance. Help communities make informed health decisions!

## Prerequisites
- Python 3.10+
- A free internet connection to call public APIs

## Setup (Windows PowerShell)
```powershell
cd "D:\prediction model"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env and paste your keys
```

## Environment (.env)
See `.env.example` and provide:
- OPENWEATHER_KEY
- WAQI_TOKEN
- GEMINI_API_KEY
- TEMPO_TOKEN (optional for NASA TEMPO, not used yet)

## Run
```powershell
python main.py
```
App runs on http://localhost:5000

## Endpoints
- GET `/api/aggregate?lat=28.6139&lon=77.2090` → Aggregated data
- POST `/api/gemini/suggest` → AI suggestion (expects JSON body from aggregate)
- GET `/` → Frontend UI

## Notes
- OpenWeather forecast is hourly; backend averages to daily AQI (1..5) and extends to 7 days if needed.
- Gemini model: `gemini-1.5-flash` (change in `app/routes.py` if needed).
- NASA TEMPO integration can be added later using `TEMPO_TOKEN`.


