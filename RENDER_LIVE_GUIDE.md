# 🎯 RENDER.COM DEPLOYMENT - Live Guide

## ✅ Status: Logged In!

---

## 📋 **STEP-BY-STEP INSTRUCTIONS:**

### **Step 1: Create New Web Service**

1. Dashboard pe **"New +"** button click karo (top-right corner)
2. Dropdown me se **"Web Service"** select karo

---

### **Step 2: Connect GitHub Repository**

1. **"Build and deploy from a Git repository"** option already selected hoga
2. Click **"Next"** or find your repository
3. Search: `TEMPO-VISION-AI`
4. Repository dikhe toh **"Connect"** button click karo

**If repository nahi dikh raha:**
- Click "Configure account" 
- Grant Render access to your repositories
- Refresh and search again

---

### **Step 3: Configure Deployment Settings**

Fill these EXACTLY:

```
Name: tempo-vision-ai
(or any name you like - this will be your URL subdomain)

Region: Oregon (US West) - Closest to you
(or Singapore if you want Asia server)

Branch: main

Root Directory: (LEAVE BLANK)

Runtime: Python 3

Build Command: pip install -r requirements.txt

Start Command: gunicorn main:app --bind 0.0.0.0:$PORT

Instance Type: Free
```

---

### **Step 4: Environment Variables** 🔑

Scroll down to **"Environment Variables"** section.

Click **"Add Environment Variable"** three times and add:

**Variable 1:**
```
Key: OPENWEATHER_API_KEY
Value: [Paste your OpenWeather API key here]
```

**Variable 2:**
```
Key: NASA_TOKEN
Value: [Paste your NASA Earthdata token here]
```

**Variable 3:**
```
Key: GEMINI_API_KEY
Value: [Paste your Google Gemini API key here]
```

**⚠️ IMPORTANT:** Don't have API keys? Here's how to get them:

1. **OpenWeather**: https://openweathermap.org/api (Sign up → Get free API key)
2. **NASA**: https://urs.earthdata.nasa.gov (Register → Create token)
3. **Gemini**: https://aistudio.google.com/app/apikey (Google account → Create API key)

---

### **Step 5: Advanced Settings** (Optional - Usually not needed)

- Auto-Deploy: Yes (recommended - auto-deploys on git push)
- Health Check Path: /

---

### **Step 6: Create Web Service!**

1. Scroll to bottom
2. Click **"Create Web Service"** button (blue/green button)
3. Deployment will start! 🚀

---

## ⏱️ **Deployment Timeline:**

```
[0-2 min]  Creating service...
[2-5 min]  Installing Python dependencies...
[5-8 min]  Building application...
[8-10 min] Starting gunicorn server...
[10 min]   ✅ LIVE!
```

You'll see logs in real-time!

---

## 🌐 **Your Live URL Will Be:**

```
https://tempo-vision-ai.onrender.com
```

(or whatever name you chose)

---

## 🎉 **After Deployment:**

1. Click on the URL to test
2. Try location search
3. Test ML predictions
4. Check NASA satellite data
5. All features should work! ✅

---

**Ready? Click "New +" and let's deploy!** 🚀
