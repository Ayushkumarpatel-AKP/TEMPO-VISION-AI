# 🌍 TEMPO VISION AI# 🌍 Air Quality Prediction System



**AI-Powered Air Quality Prediction Platform with NASA Integration**[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)



Real-time air quality monitoring and 24-hour AQI prediction using Machine Learning, NASA satellite data, and weather APIs.**AI-Powered Air Quality Monitoring & 24-Hour Prediction Platform with NASA Satellite Integration**



---Real-time air quality monitoring system that combines Machine Learning, NASA satellite data, and weather APIs to predict AQI 24 hours in advance. Help communities make informed health decisions!



## 🚀 Features## Prerequisites

- Python 3.10+

- **Real-time AQI Monitoring** - Live air quality index for any location- A free internet connection to call public APIs

- **24-Hour Prediction** - ML-powered AQI forecasts

- **Interactive Map** - Leaflet-based location search## Setup (Windows PowerShell)

- **NASA Integration** - Satellite data for enhanced predictions```powershell

- **AI Insights** - Google Gemini powered suggestionscd "D:\prediction model"

- **AR Weather View** - Augmented reality weather visualizationpython -m venv .venv

.\.venv\Scripts\Activate.ps1

---pip install -r requirements.txt

copy .env.example .env

## 🛠️ Tech Stack# Edit .env and paste your keys

```

- **Backend:** Flask 3.0.3, Python 3.11

- **ML:** Scikit-learn 1.5.2, Pandas, NumPy## Environment (.env)

- **APIs:** OpenWeather, NASA Earthdata, Google GeminiSee `.env.example` and provide:

- **Frontend:** Vanilla JavaScript, Leaflet Maps, Chart.js- OPENWEATHER_KEY

- WAQI_TOKEN

---- GEMINI_API_KEY

- TEMPO_TOKEN (optional for NASA TEMPO, not used yet)

## 📦 Installation

## Run

### 1. Clone Repository```powershell

```bashpython main.py

git clone https://github.com/Ayushkumarpatel-AKP/TEMPO-VISION-AI.git```

cd TEMPO-VISION-AIApp runs on http://localhost:5000

```

## Endpoints

### 2. Create Virtual Environment- GET `/api/aggregate?lat=28.6139&lon=77.2090` → Aggregated data

```bash- POST `/api/gemini/suggest` → AI suggestion (expects JSON body from aggregate)

python -m venv .venv- GET `/` → Frontend UI

.\.venv\Scripts\Activate.ps1  # Windows

source .venv/bin/activate     # Linux/Mac## Notes

```- OpenWeather forecast is hourly; backend averages to daily AQI (1..5) and extends to 7 days if needed.

- Gemini model: `gemini-1.5-flash` (change in `app/routes.py` if needed).

### 3. Install Dependencies- NASA TEMPO integration can be added later using `TEMPO_TOKEN`.

```bash

pip install -r requirements.txt

```

### 4. Setup Environment Variables
Copy `.env.example` to `.env` and add your API keys:
```bash
OPENWEATHER_KEY=your_openweather_api_key
GEMINI_API_KEY=your_google_gemini_api_key
```

### 5. Run Application
```bash
python main.py
```

Visit: http://localhost:5000

---

## 🔑 API Keys

### OpenWeather API (Required)
- Get FREE: https://openweathermap.org/api
- Sign up → API Keys → Copy

### Google Gemini API (Required)
- Get FREE: https://aistudio.google.com/app/apikey
- Create API Key → Copy

### NASA EDSA TOKEN
- Get FREE: https://NASA.com/apikey
- Create API Key → Copy
---

## 🚂 Deploy to Railway

### Quick Deploy
1. Fork this repository
2. Go to [Railway](https://railway.app)
3. Create New Project → Deploy from GitHub
4. Select `TEMPO-VISION-AI` repository
5. Add environment variables:
   - `OPENWEATHER_KEY`
   - `GEMINI_API_KEY`
6. Generate Domain
7. Done! 🎉

Detailed guide: `RAILWAY_DEPLOY_COMPLETE.md`

---

## 📊 API Endpoints

### Main Endpoints
- `GET /` - Web interface
- `GET /api/aggregate?lat={lat}&lon={lon}` - Combined data
- `POST /api/gemini/suggest` - AI suggestions
- `GET /api/nasa/comprehensive?lat={lat}&lon={lon}` - NASA data

### ML Endpoints
- `POST /api/ml/predict` - Predict AQI
- `GET /api/ml/model-info` - Model information

---

## 📁 Project Structure

```
TEMPO-VISION-AI/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── routes.py            # API routes
│   ├── config.py            # Configuration
│   ├── ml_model.py          # ML prediction model
│   ├── nasa_earthdata.py    # NASA API integration
│   └── services/
│       └── external.py      # External API services
├── models/
│   └── weather_aqi_model.joblib  # Trained ML model
├── static/
│   ├── app.js               # Frontend JavaScript
│   └── styles.css           # Styling
├── templates/
│   └── index.html           # Main UI
├── main.py                  # Entry point
├── requirements.txt         # Python dependencies
├── runtime.txt              # Python version
├── Procfile                 # Deployment command
└── .env.example             # Environment template
```

---

## 🎯 Usage

1. **Search Location** - Type city name or use map
2. **View Current AQI** - Real-time air quality data
3. **Check Prediction** - 24-hour AQI forecast
4. **Get AI Insights** - Health recommendations
5. **Explore AR** - Click AR button for immersive view

---

## 🐛 Troubleshooting

### Import Errors
Ensure Python 3.11 and all dependencies installed:
```bash
python --version  # Should be 3.11.x
pip install -r requirements.txt
```

### API Errors
- Verify API keys in `.env` file
- Check variable names: `OPENWEATHER_KEY`, `GEMINI_API_KEY`
- Test keys individually

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

---

## 📝 License

This project is open source and available under the MIT License.

---

## 👥 Authors

**Ayush Kumar Patel**
- GitHub: [@Ayushkumarpatel-AKP](https://github.com/Ayushkumarpatel-AKP)

---

## 🙏 Acknowledgments

- NASA Earthdata for satellite data
- OpenWeather for weather APIs
- Google Gemini for AI capabilities
- Railway for hosting platform

---

**⭐ Star this repo if you find it useful!**
