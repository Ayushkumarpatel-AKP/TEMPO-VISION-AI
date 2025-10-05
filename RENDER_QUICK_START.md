# 🚀 RENDER.COM DEPLOYMENT - Quick Steps

## Step 1: Create GitHub Repository ✅

**Browser me page khul gaya hai!**

Fill the form:
- Repository name: `tempo-vision-ai`
- Description: `ML-powered air quality prediction with NASA satellite integration`
- ✅ Public
- Click "Create repository"

---

## Step 2: Push Code to GitHub

**After creating repo, run this:**

```powershell
# This will push your code
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/tempo-vision-ai.git
git push -u origin main
```

**Replace YOUR_USERNAME with your actual GitHub username!**

---

## Step 3: Deploy on Render.com

1. Go to: https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Select `tempo-vision-ai` repository
5. Configure:
   - Name: `tempo-vision-ai`
   - Environment: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn main:app`
   - Instance Type: Free

6. Add Environment Variables:
   ```
   OPENWEATHER_API_KEY = your_key
   NASA_TOKEN = your_token
   GEMINI_API_KEY = your_key
   ```

7. Click "Create Web Service"

8. Wait 5-10 minutes

9. Live at: `https://tempo-vision-ai.onrender.com`

---

## ⚡ Quick Commands Summary

```powershell
# After creating GitHub repo:
git remote add origin https://github.com/YOUR_USERNAME/tempo-vision-ai.git
git push -u origin main

# Then deploy on Render dashboard (no CLI needed)
```

---

**Total time: 10-15 minutes for full deployment!** 🎉
