# 🚂 Railway Deployment Guide - TEMPO VISION AI

## ✅ Prerequisites Completed
- [x] GitHub Repository Created: https://github.com/Ayushkumarpatel-AKP/TEMPO-VISION-AI
- [x] All Code Pushed to GitHub
- [x] Railway CLI Installed & Logged In
- [x] Deployment Files Ready (Procfile, runtime.txt, requirements.txt)

---

## 🔧 Step-by-Step Deployment

### **Step 1: Authorize GitHub Integration** ⚠️ **DO THIS FIRST**

The Railway integrations page is already open in your browser. Now:

1. Find the **GitHub** section on the page
2. Click **"Configure"** or **"Install GitHub App"** button
3. In the GitHub authorization page:
   - Select **"All repositories"** (recommended)
   - OR select **"Only select repositories"** → choose **"TEMPO-VISION-AI"**
4. Click **"Save"** or **"Install"**
5. You'll be redirected back to Railway

---

### **Step 2: Create New Project on Railway**

1. Go to Railway Dashboard: https://railway.app/dashboard
2. Click **"New Project"** (big purple button)
3. Select **"Deploy from GitHub repo"**
4. Find and click **"TEMPO-VISION-AI"** repository
5. Click **"Deploy Now"**

Railway will automatically:
- ✅ Detect it's a Python project
- ✅ Use `runtime.txt` for Python 3.11.0
- ✅ Install dependencies from `requirements.txt`
- ✅ Use `Procfile` to start gunicorn server

---

### **Step 3: Add Environment Variables** 🔑

After deployment starts, configure your API keys:

1. In your Railway project, click **"Variables"** tab
2. Click **"+ New Variable"**
3. Add these **EXACT** variable names:

```
OPENWEATHER_KEY = your_actual_openweather_api_key
GEMINI_API_KEY = your_actual_google_gemini_api_key
```

**Optional Variables** (if you have them):
```
WAQI_TOKEN = your_waqi_token
TEMPO_TOKEN = your_nasa_tempo_token
```

**⚠️ IMPORTANT:** Use the exact variable names above! They match your `config.py` file.

4. Click **"Add"** for each variable

---

### **Step 4: Generate Public Domain**

1. Go to **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"**
4. You'll get a URL like: `https://tempo-vision-ai-production.up.railway.app`

---

### **Step 5: Wait for Deployment** ⏱️

- Build time: **3-5 minutes**
- Watch the **"Deployments"** tab for build logs
- Look for: ✅ **"Success"** status

---

## 📋 Required API Keys

### **1. OpenWeather API** (Required)
- Get it FREE: https://openweathermap.org/api
- Sign up → API Keys → Copy your key
- Add as: `OPENWEATHER_KEY`

### **2. Google Gemini API** (Required)
- Get it FREE: https://aistudio.google.com/app/apikey
- Create API Key → Copy
- Add as: `GEMINI_API_KEY`

### **3. WAQI Token** (Optional)
- Get it: https://aqicn.org/data-platform/token/
- Add as: `WAQI_TOKEN`

### **4. NASA TEMPO Token** (Optional)
- Get it: https://urs.earthdata.nasa.gov/
- Add as: `TEMPO_TOKEN`

---

## 🧪 Testing Your Deployment

Once deployed, test these endpoints:

1. **Homepage**: `https://your-railway-url.up.railway.app/`
2. **API Test**: `https://your-railway-url.up.railway.app/api/aggregate?lat=28.6139&lon=77.2090`
3. **Features to Verify**:
   - ✅ Map loads correctly
   - ✅ Location search works
   - ✅ AQI prediction displays
   - ✅ Weather forecast shows
   - ✅ AR button links to external app
   - ✅ AI suggestions appear

---

## 🎯 Quick Command Reference

### Check Deployment Status
```bash
railway status
```

### View Live Logs
```bash
railway logs
```

### Open Railway Dashboard
```bash
railway open
```

---

## 🐛 Troubleshooting

### **Build Fails**
- Check **Deployments** tab for error messages
- Verify all dependencies in `requirements.txt`
- Ensure Python 3.11.0 in `runtime.txt`

### **App Crashes on Start**
- Check environment variables are set correctly
- View logs: `railway logs`
- Verify `Procfile` has correct command

### **API Errors**
- Verify API keys are valid and active
- Check variable names match exactly: `OPENWEATHER_KEY`, `GEMINI_API_KEY`
- Test API keys locally first

### **Timeout Errors**
- Gunicorn timeout set to 120s in Procfile
- For slower predictions, increase: `--timeout 180`

---

## 💰 Railway Free Tier

- **$5 FREE** credit every month
- Automatically renews
- No credit card required
- Perfect for this project!

---

## 🔄 Redeployment After Code Changes

Automatic deployment on push:
```bash
git add .
git commit -m "Your update message"
git push origin main
```

Railway will automatically detect the push and redeploy! 🚀

---

## ✅ Deployment Checklist

- [ ] GitHub authorized on Railway
- [ ] Project created from TEMPO-VISION-AI repo
- [ ] `OPENWEATHER_KEY` environment variable added
- [ ] `GEMINI_API_KEY` environment variable added
- [ ] Domain generated
- [ ] Deployment successful (green checkmark)
- [ ] Homepage loads correctly
- [ ] API endpoints working
- [ ] All features tested

---

**🎉 Once all steps are complete, your TEMPO VISION AI will be live!**

Railway URL: `https://tempo-vision-ai-production.up.railway.app`

**Need help?** Railway has excellent logs - just click "Deployments" → "View Logs"
