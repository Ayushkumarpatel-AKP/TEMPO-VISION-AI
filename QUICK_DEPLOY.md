# 🚀 Quick Deploy Commands

## Option 1: Render.com (One-Click)

### Step 1: Install Gunicorn
```powershell
.\.venv\Scripts\pip.exe install gunicorn
```

### Step 2: Push to GitHub
```powershell
# Initialize Git
git init

# Add all files
git add .

# Commit
git commit -m "Initial deployment"

# Add GitHub remote (create repo first on github.com)
git remote add origin https://github.com/YOUR_USERNAME/air-quality-prediction.git

# Push
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Select your repository
5. Render auto-detects settings from `render.yaml`
6. Add environment variables:
   ```
   OPENWEATHER_API_KEY = your_key_here
   NASA_TOKEN = your_token_here
   GEMINI_API_KEY = your_key_here
   ```
7. Click "Create Web Service"
8. Wait 5-10 minutes ⏰
9. Done! Your site is live! 🎉

---

## Option 2: Railway.app (Super Fast)

### One-Command Deploy:
```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up

# Add environment variables via dashboard
```

**Live in 3 minutes!** ⚡

---

## Option 3: Vercel (Frontend-focused, already configured!)

### Deploy with Vercel CLI:
```powershell
# Install Vercel
npm install -g vercel

# Deploy
vercel

# Follow prompts
# Add environment variables when asked
```

**Note**: Vercel has 10s timeout for serverless functions. Some ML predictions might be slow.

---

## Local Testing

### Test Gunicorn locally:
```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run with Gunicorn
.\.venv\Scripts\gunicorn.exe main:app --bind 0.0.0.0:5000

# Open: http://localhost:5000
```

---

## Environment Variables

### Get API Keys:

1. **OpenWeather API**:
   - Sign up: [openweathermap.org/api](https://openweathermap.org/api)
   - Free tier: 1000 calls/day
   - Copy API key

2. **NASA Earthdata**:
   - Sign up: [urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov)
   - Register application
   - Get bearer token

3. **Google Gemini AI**:
   - Go to: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - Create API key
   - Copy key

### Add to Deployment:
- Render: Environment tab in dashboard
- Railway: Variables tab
- Vercel: Settings → Environment Variables

---

## Troubleshooting

### Issue: "Application failed to start"
**Solution**: Check logs in deployment dashboard

### Issue: "Module not found"
**Solution**: Ensure all dependencies in `requirements.txt`

### Issue: "API timeout"
**Solution**: Increase timeout in `render.yaml` (already set to 120s)

### Issue: "Out of memory"
**Solution**: Reduce model size or upgrade plan

---

## Post-Deployment Checklist

- [ ] Site loads successfully
- [ ] Location search works
- [ ] Map displays properly
- [ ] Predictions working
- [ ] NASA data loading
- [ ] All APIs responding
- [ ] Mobile responsive
- [ ] HTTPS enabled

---

## Share Your Project

### Add live URL to:
- README.md
- GitHub repo description
- Resume/Portfolio
- LinkedIn post
- Presentation slides

### Example:
```
🌍 Live Demo: https://air-quality-prediction.onrender.com
📂 GitHub: https://github.com/YOUR_USERNAME/air-quality-prediction
```

---

**Total deployment time**: 15-20 minutes from scratch! 🚀
