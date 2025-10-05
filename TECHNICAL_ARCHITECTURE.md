# 🏗️ System Architecture - Technical Overview

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Leaflet.js  │  │  Chart.js    │  │  JavaScript  │          │
│  │  (Maps)      │  │  (Viz)       │  │  (Logic)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                     HTML5 + CSS3 (Space Theme)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ AJAX Requests
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FLASK API SERVER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Routes (routes.py)                                       │  │
│  │  ├── /api/weather           (Current weather + AQI)      │  │
│  │  ├── /api/predict           (24h ML prediction)          │  │
│  │  ├── /api/nasa/aerosol      (NASA satellite data)        │  │
│  │  ├── /api/nasa/fires        (Fire detection)             │  │
│  │  ├── /api/gemini            (AI insights)                │  │
│  │  └── /api/train             (Model training)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ML Model (ml_model.py)                                   │  │
│  │  ├── Random Forest Classifier                            │  │
│  │  ├── Training Pipeline                                   │  │
│  │  ├── Cross-validation                                    │  │
│  │  └── Prediction Engine                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ External API Calls
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ OpenWeather │  │ NASA TEMPO  │  │ Google      │            │
│  │ API         │  │ Satellite   │  │ Gemini AI   │            │
│  │             │  │             │  │             │            │
│  │ - Weather   │  │ - Aerosol   │  │ - Insights  │            │
│  │ - AQI       │  │ - Fires     │  │ - Analysis  │            │
│  │ - Forecast  │  │ - Precip    │  │ - NLP       │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

### User Journey: Search Location → Get Prediction

```
User Types "Tokyo"
    ▼
JavaScript sends AJAX request to Nominatim API
    ▼
Get coordinates (35.6762, 139.6503)
    ▼
Update map position
    ▼
Call Flask API: /api/weather?lat=35.6762&lon=139.6503
    ▼
Flask calls OpenWeather API
    ▼
Returns: Temperature, Humidity, Wind, AQI, Pollutants
    ▼
Display in UI
    ▼
User clicks "Predict 24h"
    ▼
Call Flask API: /api/predict
    ▼
Flask loads ML model (joblib)
    ▼
Model predicts using weather features
    ▼
Returns: Predicted AQI (e.g., 165 - Unhealthy)
    ▼
Display with color-coded badge
```

---

## 🧠 Machine Learning Pipeline

### Training Phase

```python
# Step 1: Data Collection
historical_data = {
    'temperature': [...],
    'humidity': [...],
    'wind_speed': [...],
    'pressure': [...],
    'aqi': [...]  # Target variable
}

# Step 2: Feature Engineering
features = ['temp', 'humidity', 'wind', 'pressure']
X = data[features]
y = data['aqi']

# Step 3: Model Training
from sklearn.ensemble import RandomForestClassifier
model = RandomForestClassifier(n_estimators=100)
model.fit(X, y)

# Step 4: Cross-Validation
from sklearn.model_selection import cross_val_score
scores = cross_val_score(model, X, y, cv=5)
accuracy = scores.mean()  # ~85%

# Step 5: Save Model
import joblib
joblib.dump(model, 'models/weather_aqi_model.joblib')
```

### Prediction Phase

```python
# Step 1: Load Model
model = joblib.load('models/weather_aqi_model.joblib')

# Step 2: Get Current Weather
weather_data = get_weather(lat, lon)

# Step 3: Prepare Features
features = [
    weather_data['temp'],
    weather_data['humidity'],
    weather_data['wind_speed'],
    weather_data['pressure']
]

# Step 4: Predict
predicted_aqi = model.predict([features])[0]

# Step 5: Return Result
return {
    'predicted_aqi': predicted_aqi,
    'category': get_aqi_category(predicted_aqi),
    'confidence': confidence_score
}
```

---

## 🛰️ NASA Integration Architecture

### TEMPO Satellite Data Flow

```
NASA Earthdata Portal
    ▼
Authenticate with API Token
    ▼
Request TEMPO L2 Data
    ├── Aerosol Optical Depth
    ├── NO2 Tropospheric Column
    ├── Fire Detection Points
    └── Precipitation Data
    ▼
NetCDF4 File Processing
    ▼
Extract Lat/Lon Grid Data
    ▼
Filter by User Location
    ▼
Send to Gemini AI for Analysis
    ▼
Return Natural Language Insights
    ▼
Display on Map + Text Panel
```

### API Endpoint Structure

```javascript
// Frontend Call
fetch('/api/nasa/comprehensive', {
    method: 'POST',
    body: JSON.stringify({ lat, lon })
})

// Backend Process
1. Fetch NASA aerosol data
2. Fetch NASA fire data
3. Fetch precipitation data
4. Combine datasets
5. Send to Gemini AI with prompt:
   "Analyze this satellite data and provide 
    health recommendations for location..."
6. Return formatted response
```

---

## 📊 Database Schema (For Future Implementation)

```sql
-- Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255),
    location_preference VARCHAR(100),
    created_at TIMESTAMP
);

-- AQI History Table
CREATE TABLE aqi_history (
    id INTEGER PRIMARY KEY,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    aqi_value INTEGER,
    pollutants JSON,
    timestamp TIMESTAMP,
    source VARCHAR(50)
);

-- Predictions Table
CREATE TABLE predictions (
    id INTEGER PRIMARY KEY,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    predicted_aqi INTEGER,
    actual_aqi INTEGER,
    prediction_time TIMESTAMP,
    target_time TIMESTAMP,
    accuracy_score DECIMAL(5, 2)
);

-- NASA Data Cache
CREATE TABLE nasa_cache (
    id INTEGER PRIMARY KEY,
    data_type VARCHAR(50),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    data_json JSON,
    fetched_at TIMESTAMP,
    expires_at TIMESTAMP
);
```

---

## 🔒 Security & Best Practices

### API Key Management
```python
# config.py
import os
from dotenv import load_env

load_env()

class Config:
    OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_KEY')
    NASA_TOKEN = os.getenv('NASA_TOKEN')
    GEMINI_API_KEY = os.getenv('GEMINI_KEY')
    
    # Never commit .env file!
```

### Rate Limiting
```python
from flask_limiter import Limiter

limiter = Limiter(
    app,
    default_limits=["100 per hour"]
)

@app.route('/api/predict')
@limiter.limit("10 per minute")
def predict():
    # Prevent abuse
    pass
```

### Error Handling
```python
@app.errorhandler(Exception)
def handle_error(error):
    return jsonify({
        'error': str(error),
        'status': 'failed'
    }), 500
```

---

## 🚀 Deployment Architecture

### Local Development
```
Windows Machine
    ├── Python 3.13 Virtual Environment
    ├── Flask Development Server (port 5000)
    ├── Static Files Served by Flask
    └── SQLite Database (if implemented)
```

### Production Deployment (Vercel)
```
GitHub Repository
    ▼
Vercel Auto-Deploy
    ├── Serverless Functions (Python)
    ├── CDN for Static Assets
    ├── Environment Variables (API Keys)
    └── HTTPS by Default
```

### Alternative: AWS Deployment
```
EC2 Instance
    ├── Ubuntu Server
    ├── Nginx (Reverse Proxy)
    ├── Gunicorn (WSGI Server)
    ├── Flask Application
    ├── PostgreSQL Database
    └── Redis Cache
```

---

## ⚡ Performance Optimization

### Caching Strategy
```python
from functools import lru_cache
from datetime import datetime, timedelta

cache = {}
CACHE_DURATION = timedelta(hours=1)

def get_weather_cached(lat, lon):
    key = f"{lat}_{lon}"
    
    if key in cache:
        data, timestamp = cache[key]
        if datetime.now() - timestamp < CACHE_DURATION:
            return data
    
    # Fetch fresh data
    data = fetch_weather_api(lat, lon)
    cache[key] = (data, datetime.now())
    return data
```

### Asynchronous Processing
```javascript
// Frontend: Parallel API calls
async function loadAllData(lat, lon) {
    const [weather, nasa, prediction] = await Promise.all([
        fetch(`/api/weather?lat=${lat}&lon=${lon}`),
        fetch(`/api/nasa/aerosol`, { method: 'POST', body: JSON.stringify({lat, lon}) }),
        fetch(`/api/predict`, { method: 'POST', body: JSON.stringify({lat, lon}) })
    ]);
    
    // All data loaded simultaneously!
}
```

---

## 📈 Scalability Considerations

### Current Limitations
- Free API tier: 1000 calls/day
- Single server instance
- No database persistence
- Synchronous processing

### Scale-Up Strategy

**Phase 1: Handle 1K Users/day**
- Implement Redis caching
- Database for historical data
- Batch prediction processing

**Phase 2: Handle 10K Users/day**
- Load balancer (multiple Flask instances)
- PostgreSQL database
- CDN for static assets
- API rate limiting

**Phase 3: Handle 100K+ Users/day**
- Microservices architecture
- Message queue (RabbitMQ/Kafka)
- Distributed caching (Redis Cluster)
- Auto-scaling infrastructure
- Premium API tiers

---

## 🔬 Testing Strategy

### Unit Tests
```python
import unittest

class TestMLModel(unittest.TestCase):
    def test_prediction_range(self):
        model = load_model()
        result = model.predict([[25, 60, 5, 1013]])
        self.assertTrue(0 <= result <= 500)
    
    def test_feature_validation(self):
        # Ensure correct features
        pass
```

### Integration Tests
```python
class TestAPIEndpoints(unittest.TestCase):
    def test_weather_endpoint(self):
        response = client.get('/api/weather?lat=28.6&lon=77.2')
        self.assertEqual(response.status_code, 200)
        self.assertIn('aqi', response.json)
```

### End-to-End Tests
```javascript
// Selenium/Playwright
describe('User Flow', () => {
    it('should search location and get prediction', async () => {
        await page.goto('http://localhost:5000');
        await page.type('#locationSearch', 'Tokyo');
        await page.click('.search-result-item:first-child');
        await page.click('#predictBtn');
        
        const result = await page.textContent('#predictionResult');
        expect(result).toContain('AQI');
    });
});
```

---

## 🎓 Learning Outcomes (For Presentation)

### What We Learned

**Technical Skills:**
- Full-stack web development
- Machine Learning implementation
- API integration and management
- Asynchronous programming
- Data visualization
- Responsive UI design

**Problem-Solving:**
- Handling API rate limits
- Managing asynchronous data fetching
- Cross-validation for ML accuracy
- Error handling and user feedback

**Professional Skills:**
- Reading API documentation (NASA, OpenWeather)
- Version control with Git
- Code organization and modularity
- Performance optimization
- Security best practices

---

## 🌟 Innovation Summary

**What Makes This Special:**

1. **Multi-Source Intelligence**
   - Weather APIs + Satellite Data + AI Analysis
   - Not just one data source

2. **Predictive Capabilities**
   - 24h advance warning
   - 7-day forecasting
   - Not reactive, but proactive

3. **Professional-Grade Data**
   - NASA TEMPO satellite (latest tech)
   - Research-quality accuracy
   - Not consumer-grade sensors

4. **Beautiful User Experience**
   - Custom space-themed design
   - Smooth animations
   - Intuitive interface

5. **Global Scalability**
   - Works anywhere in world
   - Not city-specific
   - Truly universal solution

---

**Use this architecture knowledge to answer deep technical questions from judges!** 🚀

Remember: Understanding your system architecture shows **engineering maturity** and **professional thinking**. 💡
