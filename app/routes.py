from __future__ import annotations

import os
import tempfile
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request, render_template

from app.services.external import (
	fetch_openweather_forecast,
	fetch_openweather_weather_forecast,
	fetch_openweather_current,
	fetch_openweather_weather_by_city,
	fetch_openweather_weather_by_coords,
	fetch_revgeo_ip,
	summarize_openweather_to_daily_aqi,
	extract_ow_pollutants,
	extract_realtime_aqi_openweather,
	compute_aqi_from_components,
)

from .ml_model import prediction_model

api_bp = Blueprint("api", __name__)
pages_bp = Blueprint("pages", __name__)


@pages_bp.get("/")
def index_page():
	return render_template("index.html")


@api_bp.get("/aggregate")
def aggregate():
	debug_notes: list[str] = []
	used: str = ""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
	except ValueError:
		return jsonify({"error": "Invalid lat/lon"}), 400

	ow_forecast = fetch_openweather_forecast(lat, lon)
	ow_current = fetch_openweather_current(lat, lon)
	ow_weather = fetch_openweather_weather_by_coords(lat, lon)

	realtime = extract_realtime_aqi_openweather(ow_current)
	if realtime:
		used = realtime["source"]
		debug_notes.append("Realtime via OpenWeather current")
	else:
		debug_notes.append("Realtime unavailable (OW current empty)")

	# Extract weather condition information
	weather_condition = None
	if ow_weather:
		weather_data = ow_weather.get("weather", [])
		if weather_data:
			condition = weather_data[0]
			weather_condition = {
				"main": condition.get("main", "Unknown"),
				"description": condition.get("description", "No description"),
				"icon": condition.get("icon", "01d"),
				"temp": ow_weather.get("main", {}).get("temp"),
				"feels_like": ow_weather.get("main", {}).get("feels_like"),
				"humidity": ow_weather.get("main", {}).get("humidity"),
				"wind_speed": ow_weather.get("wind", {}).get("speed"),
				"visibility": ow_weather.get("visibility")
			}
		debug_notes.append("Weather condition data fetched")

	daily_aqi = summarize_openweather_to_daily_aqi(ow_forecast, days=7)
	if daily_aqi:
		debug_notes.append("Forecast daily from OpenWeather")
	else:
		debug_notes.append("Forecast unavailable at exact point; retrying rounded coords")
		lat_r = round(lat, 2)
		lon_r = round(lon, 2)
		if (lat_r, lon_r) != (lat, lon):
			ow_fc2 = fetch_openweather_forecast(lat_r, lon_r)
			daily2 = summarize_openweather_to_daily_aqi(ow_fc2, days=7)
			if daily2:
				daily_aqi = daily2
				debug_notes.append(f"Forecast found at rounded {lat_r},{lon_r}")

	ow_components = extract_ow_pollutants(ow_forecast, ow_current)
	computed = compute_aqi_from_components(ow_components)

	return jsonify(
		{
			"location": {"lat": lat, "lon": lon},
			"sources": {
				"openweather": bool(ow_forecast or ow_current)
			},
			"used": used,
			"realtimeAqi": realtime,
			"weatherCondition": weather_condition,
			"openweather": {"forecast": bool(ow_forecast), "current": bool(ow_current)},
			"pollutants": {"openweather": ow_components},
			"aqi500": computed,  # overall 0–500 and per-pollutant subindices
			"dailyAqi": daily_aqi,
			"debug": debug_notes,
		}
	)


@api_bp.get("/weather")
def weather_by_city():
	city = request.args.get("city", "")
	if not city:
		return jsonify({"error": "city required"}), 400
	data = fetch_openweather_weather_by_city(city)
	return jsonify({"city": city, "weather": data or {}})


@api_bp.get("/weather-test")
def weather_test():
	"""Quick weather API test endpoint"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		
		# Check if imports work
		from flask import current_app
		api_key = current_app.config.get("OPENWEATHER_KEY")
		
		if not api_key:
			return jsonify({
				"success": False,
				"error": "OpenWeather API key not configured",
				"api_key_set": False,
				"debug": "Check .env file for OPENWEATHER_KEY"
			}), 500
		
		ow_current = fetch_openweather_current(lat, lon)
		ow_forecast = fetch_openweather_forecast(lat, lon)
		
		return jsonify({
			"success": True,
			"current_data": bool(ow_current),
			"forecast_data": bool(ow_forecast),
			"current_sample": ow_current.get('list', [{}])[0] if ow_current else None,
			"api_key_set": True,
			"api_key_length": len(api_key),
			"coordinates": {"lat": lat, "lon": lon},
			"debug": "weather-test endpoint working"
		})
		
	except Exception as e:
		import traceback
		return jsonify({
			"success": False,
			"error": str(e),
			"error_type": type(e).__name__,
			"traceback": traceback.format_exc(),
			"api_key_set": bool(current_app.config.get("OPENWEATHER_KEY"))
		}), 500


@api_bp.get("/revgeo")
def revgeo_ip():
	data = fetch_revgeo_ip() or {}
	return jsonify({"ip": data.get("ip"), "city": data.get("city"), "lat": data.get("latitude"), "lon": data.get("longitude"), "raw": data})


@api_bp.post("/gemini/suggest")
def gemini_suggest():
	from google.generativeai import GenerativeModel, configure
	from flask import current_app

	data: Dict[str, Any] = request.get_json(silent=True) or {}
	daily = data.get("dailyAqi", [])
	realtime = data.get("realtimeAqi")
	location = data.get("location", {})
	used = data.get("used", "")
	pollutants = data.get("pollutants", {})

	api_key = current_app.config.get("GEMINI_API_KEY")
	def heuristic(daily: list, realtime: dict | None, used: str, pollutants: dict) -> str:
		vals = [v for _, v in daily] if daily else []
		avg = (sum(vals) / len(vals)) if vals else None
		current_str = f"Current AQI {realtime['aqi']} (via {realtime['source']})" if realtime else "Current AQI unavailable"
		trend = ""
		if len(vals) >= 2:
			trend = "rising" if vals[-1] > vals[0] else ("falling" if vals[-1] < vals[0] else "stable")
		pm25 = pollutants.get("openweather", {}).get("pm2_5")
		pm_note = f" PM2.5 ~ {pm25}µg/m³." if pm25 is not None else ""
		head = f"{current_str}. Avg next-7 {avg:.1f}. Trend {trend}." if avg is not None else current_str + "."
		advice = (
			"\n- Looks good today." if (realtime and realtime.get('aqi') and realtime['aqi'] <= 2) else
			"\n- Moderate; sensitive groups take care." if (realtime and realtime.get('aqi') and realtime['aqi'] <= 3) else
			"\n- Unhealthy; limit outdoor time." if realtime else ""
		)
		return head + advice + pm_note

	if not api_key:
		return jsonify({"suggestion": heuristic(daily, realtime, used, pollutants)})

	configure(api_key=api_key)
	model = GenerativeModel("gemini-1.5-flash")

	prompt = (
		"Act as a friendly air-quality chatbot.\n"
		"Answer conversationally with short bullet points.\n"
		"Include: current AQI (and source), short 7-day outlook, and health tips.\n\n"
		f"Location: {location}\n"
		f"Realtime: {realtime}\n"
		f"7-day AQI: {daily}\n"
		f"Pollutants: {pollutants}\n"
	)

	try:
		resp = model.generate_content(prompt)
		text = getattr(resp, "text", None) or heuristic(daily, realtime, used, pollutants)
	except Exception:
		text = heuristic(daily, realtime, used, pollutants)
	return jsonify({"suggestion": text})


@api_bp.post("/gemini/chat")
def gemini_chat():
	from google.generativeai import GenerativeModel, configure
	from flask import current_app
	import time

	body: Dict[str, Any] = request.get_json(silent=True) or {}
	message: str = body.get("message", "")
	history: List[Dict[str, str]] = body.get("history", [])
	context: Dict[str, Any] = body.get("context", {})
	
	if not message:
		return jsonify({"error": "message required"}), 400

	api_key = current_app.config.get("GEMINI_API_KEY")
	
	def fallback_reply(msg: str, ctx: Dict[str, Any]) -> str:
		realtime = ctx.get("realtimeAqi")
		daily = ctx.get("dailyAqi", [])
		vals = [v for _, v in daily] if daily else []
		avg = (sum(vals)/len(vals)) if vals else None
		
		# Smart fallback responses based on message content
		msg_lower = msg.lower()
		if any(word in msg_lower for word in ['health', 'safe', 'recommend', 'advice']):
			if realtime and 'aqi' in realtime:
				aqi = realtime['aqi']
				if aqi <= 2:
					return "✅ Air quality looks good! Safe for outdoor activities. Consider light exercise outside."
				elif aqi <= 3:
					return "⚠️ Moderate air quality. Sensitive individuals should limit prolonged outdoor exposure."
				else:
					return "🚫 Poor air quality. Limit outdoor activities and consider wearing a mask if you must go outside."
			return "I'd need current air quality data to give specific health advice. Try refreshing the location data first."
		
		if any(word in msg_lower for word in ['current', 'now', 'today']):
			head = f"Current AQI: {realtime['aqi']} (OpenWeather scale 1-5)" if (realtime and 'aqi' in realtime) else "Current AQI unavailable"
			foot = f" | 7-day average: {avg:.1f}" if avg is not None else ""
			return f"{head}{foot}"
		
		if any(word in msg_lower for word in ['forecast', 'tomorrow', 'week', 'trend']):
			if daily and len(daily) > 1:
				trend = "improving" if daily[-1][1] < daily[0][1] else ("worsening" if daily[-1][1] > daily[0][1] else "stable")
				return f"📊 7-day forecast available. Trend appears to be {trend}. Average AQI: {avg:.1f}" if avg else "📊 7-day forecast data available."
			return "No forecast data available for this location."
			
		# Default friendly response
		head = f"Current AQI: {realtime['aqi']}" if (realtime and 'aqi' in realtime) else "Current AQI unavailable"
		foot = f" | 7-day avg: {avg:.1f}" if avg is not None else ""
		return f"👋 Hi! {head}{foot}. Ask me about health recommendations, current conditions, or forecasts!"

	if not api_key or api_key == "your_gemini_api_key_here" or api_key == "AIzaSyAYourGeminiAPIKeyHere":
		return jsonify({"reply": fallback_reply(message, context)})

	try:
		configure(api_key=api_key)
		model = GenerativeModel("gemini-1.5-flash")

		# Enhanced system prompt for better air quality conversations
		sys_prompt = """You are AirQuality AI, a friendly and knowledgeable air quality assistant. 

Your personality:
- Helpful, empathetic, and health-focused
- Use emojis appropriately (🌬️💨🏃‍♀️🌳 etc.)
- Keep responses concise but informative
- Always prioritize health and safety

Your knowledge areas:
- Air quality interpretation (AQI scales, pollutants)
- Health recommendations based on air quality
- Air pollution sources and mitigation
- Weather impacts on air quality

Response guidelines:
- Use bullet points for multiple suggestions
- Provide specific, actionable advice
- Reference the current data when available
- Explain AQI scales when relevant (OpenWeather uses 1-5, EPA uses 0-500)
- Be encouraging when air quality is good, cautious when poor"""

		# Build conversation context
		current_data = ""
		if context:
			realtime = context.get("realtimeAqi")
			daily = context.get("dailyAqi", [])
			location = context.get("location", {})
			
			if realtime:
				current_data += f"\nCurrent AQI: {realtime.get('aqi')} (OpenWeather 1-5 scale)"
			if location:
				current_data += f"\nLocation: {location.get('lat', 'N/A')}, {location.get('lon', 'N/A')}"
			if daily:
				trend = "improving" if len(daily) > 1 and daily[-1][1] < daily[0][1] else ("worsening" if len(daily) > 1 and daily[-1][1] > daily[0][1] else "stable")
				current_data += f"\n7-day trend: {trend}"

		# Build conversation history
		conversation = f"{sys_prompt}\n\nCurrent air quality data:{current_data}\n\nConversation:"
		for h in history[-8:]:  # Last 8 messages for context
			role = h.get('role', 'user')
			content = h.get('content', '')
			conversation += f"\n{role}: {content}"
		
		conversation += f"\nuser: {message}\nassistant:"

		# Generate response with timeout
		response = model.generate_content(
			conversation,
			generation_config={
				"temperature": 0.7,
				"top_p": 0.8,
				"top_k": 40,
				"max_output_tokens": 200,
			}
		)
		
		reply_text = getattr(response, "text", None)
		if not reply_text:
			raise Exception("Empty response from Gemini")
			
		return jsonify({"reply": reply_text.strip()})
		
	except Exception as e:
		print(f"Gemini API error: {e}")
		return jsonify({"reply": fallback_reply(message, context)})


# ============ ML PREDICTION ENDPOINTS ============

@api_bp.post("/ml/train")
def train_ml_model():
	"""Train ML models with synthetic or provided data"""
	try:
		# Get training parameters
		body = request.get_json(silent=True) or {}
		use_synthetic = body.get("use_synthetic", True)
		num_samples = body.get("num_samples", 1000)
		target_column = body.get("target_column", "aqi")
		
		if use_synthetic:
			# Generate synthetic data for training
			training_data = prediction_model.generate_synthetic_data(num_samples)
		else:
			# Use provided data
			training_data = body.get("data", [])
			if not training_data:
				return jsonify({"error": "No training data provided"}), 400
		
		# Train models
		performance = prediction_model.train_models(training_data, target_column)
		
		# Save models
		prediction_model.save_model()
		
		return jsonify({
			"status": "success",
			"message": f"Models trained successfully with {len(training_data)} samples",
			"performance": performance,
			"models_trained": list(performance.keys())
		})
		
	except Exception as e:
		return jsonify({"error": f"Training failed: {str(e)}"}), 500


@api_bp.post("/ml/predict")
def predict_aqi():
	"""Make AQI prediction using trained model"""
	try:
		body = request.get_json(silent=True) or {}
		model_name = body.get("model", "random_forest")
		input_data = body.get("data", {})
		
		if not input_data:
			return jsonify({"error": "No input data provided"}), 400
		
		# Try to load model if not already loaded
		if not prediction_model.trained_models:
			if not prediction_model.load_model():
				return jsonify({"error": "No trained model available. Please train first."}), 400
		
		# Make prediction
		prediction = prediction_model.predict(input_data, model_name)
		
		return jsonify({
			"prediction": round(prediction, 2),
			"model_used": model_name,
			"input_data": input_data
		})
		
	except Exception as e:
		return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


@api_bp.get("/ml/predict-future")
def predict_future_aqi():
	"""Predict future AQI values"""
	try:
		hours_ahead = int(request.args.get("hours", 24))
		model_name = request.args.get("model", "random_forest")
		
		# Limit hours to reasonable range
		hours_ahead = min(max(1, hours_ahead), 168)  # 1 hour to 1 week
		
		# Try to load model if not already loaded
		if not prediction_model.trained_models:
			if not prediction_model.load_model():
				return jsonify({"error": "No trained model available. Please train first."}), 400
		
		# Get future predictions
		predictions = prediction_model.predict_future(hours_ahead, model_name)
		
		return jsonify({
			"predictions": predictions,
			"hours_predicted": len(predictions),
			"model_used": model_name
		})
		
	except Exception as e:
		return jsonify({"error": f"Future prediction failed: {str(e)}"}), 500


@api_bp.get("/ml/model-info")
def get_model_info():
	"""Get information about trained models"""
	try:
		# Try to load model if not already loaded
		if not prediction_model.trained_models:
			prediction_model.load_model()
		
		info = {
			"models_available": list(prediction_model.trained_models.keys()),
			"performance": prediction_model.model_performance,
			"feature_names": prediction_model.feature_names,
			"is_trained": len(prediction_model.trained_models) > 0
		}
		
		# Get feature importance for tree-based models
		feature_importance = {}
		for model_name in ["random_forest", "gradient_boosting"]:
			if model_name in prediction_model.trained_models:
				importance = prediction_model.get_feature_importance(model_name)
				if importance:
					feature_importance[model_name] = importance
		
		info["feature_importance"] = feature_importance
		
		return jsonify(info)
		
	except Exception as e:
		return jsonify({"error": f"Failed to get model info: {str(e)}"}), 500


@api_bp.post("/ml/quick-predict")
def quick_predict_current():
	"""Quick prediction using current weather data"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		model_name = request.args.get("model", "random_forest")
		
		# Get current weather data
		ow_current = fetch_openweather_current(lat, lon)
		ow_forecast = fetch_openweather_forecast(lat, lon)
		
		if not ow_current and not ow_forecast:
			return jsonify({"error": "Unable to fetch weather data"}), 400
		
		# Extract current conditions
		current_pollutants = extract_ow_pollutants(ow_forecast, ow_current)
		current_aqi = extract_realtime_aqi_openweather(ow_current)
		
		# Prepare input data for prediction
		input_data = {
			"temp": 25,  # Default values
			"humidity": 60,
			"pressure": 1013,
			"wind_speed": 5,
			"visibility": 10,
			**current_pollutants  # Add current pollutant data
		}
		
		# Try to load model if not already loaded
		if not prediction_model.trained_models:
			if not prediction_model.load_model():
				# Train with synthetic data if no model exists
				training_data = prediction_model.generate_synthetic_data(500)
				prediction_model.train_models(training_data)
				prediction_model.save_model()
		
		# Make prediction
		prediction = prediction_model.predict(input_data, model_name)
		
		return jsonify({
			"prediction": round(prediction, 2),
			"current_aqi": current_aqi.get("aqi") if current_aqi else None,
			"model_used": model_name,
			"location": {"lat": lat, "lon": lon},
			"input_features": input_data
		})
		
	except Exception as e:
		return jsonify({"error": f"Quick prediction failed: {str(e)}"}), 500


# TEMPO Satellite Data Integration Routes
# Make TEMPO processor optional (requires xarray and netCDF4)
try:
	from .tempo_processor import tempo_processor
	TEMPO_AVAILABLE = True
except ImportError:
	tempo_processor = None
	TEMPO_AVAILABLE = False

# NASA Earthdata Integration Routes
from .nasa_earthdata import NASAEarthdataClient

# Initialize NASA client with token
NASA_TOKEN = "eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6InByYXNoYW50NzIzIiwiZXhwIjoxNzY0NzQ2ODU3LCJpYXQiOjE3NTk1NjI4NTcsImlzcyI6Imh0dHBzOi8vdXJzLmVhcnRoZGF0YS5uYXNhLmdvdiIsImlkZW50aXR5X3Byb3ZpZGVyIjoiZWRsX29wcyIsImFjciI6ImVkbCIsImFzc3VyYW5jZV9sZXZlbCI6M30.kuwEpNQ9AmM0HWp99R4vpITfvc_ou6_6adv-lzqKuGwOX-K5cmMa0WaSU_9FNk4kDhl4vB7_8ygx-djSPpd0YoBi1azpJyZQPeSjtdRVOlYmF2vkLeS3wyz005aH0Ail8NNPFEfmn0IkmYrCFlUw7TfYvpmG0Ds69LrLGLemuFDN9gcrT_oitNTCFo9UyCjUYz0Goe1Iwgm-q3gi3TpglkpXiPi59S_gEpe6tSVfdq-rLtsYl304YIRsAT6fZK9C2aXfAXF_bro59_TFFNpznokfInel3uodAXeBi900p8H5X6YNZcNbGn2Os55tJrOy2MINWTqszfXA9fVT9VlsHg"
nasa_client = NASAEarthdataClient(NASA_TOKEN)

@api_bp.get("/nasa/aerosol")
def get_nasa_aerosol():
	"""Get MODIS aerosol data for air quality analysis"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		days = int(request.args.get("days", "7"))
		
		data = nasa_client.get_modis_aerosol_data(lat, lon, days_back=days)
		return jsonify(data)
		
	except Exception as e:
		return jsonify({"error": f"NASA aerosol data failed: {str(e)}"}), 500


@api_bp.get("/nasa/fires")
def get_nasa_fires():
	"""Get MODIS fire data for air quality impact assessment"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		days = int(request.args.get("days", "7"))
		
		data = nasa_client.get_fire_data(lat, lon, days_back=days)
		return jsonify(data)
		
	except Exception as e:
		return jsonify({"error": f"NASA fire data failed: {str(e)}"}), 500


@api_bp.get("/nasa/precipitation")
def get_nasa_precipitation():
	"""Get GPM precipitation data for weather impact analysis"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		days = int(request.args.get("days", "3"))
		
		data = nasa_client.get_precipitation_data(lat, lon, days_back=days)
		return jsonify(data)
		
	except Exception as e:
		return jsonify({"error": f"NASA precipitation data failed: {str(e)}"}), 500


@api_bp.get("/nasa/comprehensive")
def get_nasa_comprehensive():
	"""Get comprehensive NASA Earth data analysis"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		
		data = nasa_client.get_comprehensive_analysis(lat, lon)
		return jsonify(data)
		
	except Exception as e:
		return jsonify({"error": f"NASA comprehensive analysis failed: {str(e)}"}), 500


@api_bp.get("/nasa/7day-forecast")
def get_nasa_7day_forecast():
	"""Get 7-day air quality forecast using NASA + Weather data"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		
		forecast_data = []
		
		# Get NASA base analysis with error handling
		try:
			nasa_data = nasa_client.get_comprehensive_analysis(lat, lon)
			base_nasa_score = nasa_data.get('combined_assessment', {}).get('overall_score', 50)
		except Exception as nasa_err:
			print(f"NASA data error: {nasa_err}")
			base_nasa_score = 50  # Default NASA score
		
		# Ensure base_nasa_score is a valid number
		if not isinstance(base_nasa_score, (int, float)) or base_nasa_score < 0:
			base_nasa_score = 50
		
		# Get weather forecast with error handling
		try:
			ow_weather_forecast = fetch_openweather_weather_forecast(lat, lon)
			ow_forecast = fetch_openweather_forecast(lat, lon)  # Keep for AQI data
		except Exception as forecast_err:
			print(f"Weather forecast error: {forecast_err}")
			ow_weather_forecast = None
			ow_forecast = None
		
		for i in range(7):
			day_date = (datetime.now() + timedelta(days=i+1)).strftime('%Y-%m-%d')
			
			# Default weather values
			temp = 25.0  # Default temperature in Celsius
			humidity = 60  # Default humidity
			pressure = 1013  # Default pressure
			wind_speed = 2.0  # Default wind speed
			
			try:
				# Try to use weather forecast data first (much better than air pollution forecast)
				if ow_weather_forecast and isinstance(ow_weather_forecast, dict) and 'list' in ow_weather_forecast:
					forecast_list = ow_weather_forecast.get('list', [])
					
					# For 5-day forecast, each day has multiple 3-hour intervals
					# We'll take the midday forecast (around 12:00) for each day
					target_day_forecasts = []
					for forecast_item in forecast_list:
						forecast_time = forecast_item.get('dt_txt', '')
						if forecast_time:
							# Check if this forecast is for our target day
							forecast_date = forecast_time.split(' ')[0]  # Get date part
							target_date = (datetime.now() + timedelta(days=i+1)).strftime('%Y-%m-%d')
							if forecast_date == target_date:
								target_day_forecasts.append(forecast_item)
					
					# Use the midday forecast if available, otherwise first available for that day
					if target_day_forecasts:
						# Try to find midday forecast (12:00)
						day_forecast = None
						for tf in target_day_forecasts:
							if '12:00:00' in tf.get('dt_txt', ''):
								day_forecast = tf
								break
						
						# If no midday forecast, use the first one for that day
						if not day_forecast:
							day_forecast = target_day_forecasts[0]
						
						if day_forecast and isinstance(day_forecast, dict):
							# Extract temperature (already in Celsius with units=metric)
							main_data = day_forecast.get('main', {})
							if 'temp' in main_data:
								temp = float(main_data['temp'])
							
							# Extract other weather data
							humidity = main_data.get('humidity', humidity)
							pressure = main_data.get('pressure', pressure)
							wind_data = day_forecast.get('wind', {})
							wind_speed = wind_data.get('speed', wind_speed)
					
					# If we couldn't find forecast for this day (beyond 5 days), use pattern
					elif i >= 5:
						# For days 6-7, extrapolate from available data with some variation
						if forecast_list:
							last_forecast = forecast_list[-1]  # Use last available forecast
							main_data = last_forecast.get('main', {})
							temp = float(main_data.get('temp', temp)) + (i - 4) * 0.5  # Slight trend
							humidity = main_data.get('humidity', humidity) + (i - 4) * 2
							pressure = main_data.get('pressure', pressure)
							wind_data = last_forecast.get('wind', {})
							wind_speed = wind_data.get('speed', wind_speed)
				
				# Fallback to current weather if forecast failed completely
				if temp == 25.0:  # Still using default temp, try current weather
					ow_current_weather = fetch_openweather_weather_by_coords(lat, lon)
					if ow_current_weather and isinstance(ow_current_weather, dict):
						main_data = ow_current_weather.get('main', {})
						if 'temp' in main_data:
							temp = float(main_data['temp'])
						humidity = main_data.get('humidity', humidity)
						pressure = main_data.get('pressure', pressure)
						wind_data = ow_current_weather.get('wind', {})
						wind_speed = wind_data.get('speed', wind_speed)
						
						# Add some daily variation for future days
						temp += (i * 0.3)  # Slight temperature trend
						humidity = max(30, min(90, humidity + (i * 1.5)))  # Bounded humidity variation
			
			except Exception as weather_err:
				# Log the error but continue with default values
				print(f"Weather data error for day {i}: {weather_err}")
				# Keep default values
			
			# Simple AQI prediction based on NASA + weather
			# Higher temp/humidity = higher AQI, higher wind = lower AQI
			try:
				# Ensure wind_speed is positive to avoid division by zero
				wind_speed = max(0.1, wind_speed)  # Minimum wind speed of 0.1 m/s
				weather_factor = (temp * 0.5 + humidity * 0.3) / wind_speed
				predicted_aqi = int(base_nasa_score + weather_factor - 20 + (i * 2))  # Slight trend
				predicted_aqi = max(10, min(300, predicted_aqi))  # Bound between 10-300
			except Exception as calc_err:
				print(f"AQI calculation error for day {i}: {calc_err}")
				# Fallback calculation
				predicted_aqi = int(base_nasa_score + (i * 5))  # Simple trend
				predicted_aqi = max(10, min(300, predicted_aqi))
			
			# Air quality level determination with error handling
			try:
				if predicted_aqi <= 50:
					level = "Good"
					color = "#00e400"
				elif predicted_aqi <= 100:
					level = "Moderate" 
					color = "#ffff00"
				elif predicted_aqi <= 150:
					level = "Unhealthy for Sensitive"
					color = "#ff7e00"
				elif predicted_aqi <= 200:
					level = "Unhealthy"
					color = "#ff0000"
				elif predicted_aqi <= 300:
					level = "Very Unhealthy"
					color = "#8f3f97"
				else:
					level = "Hazardous"
					color = "#7e0023"
			except Exception:
				level = "Unknown"
				color = "#999999"
			
			# Safely construct forecast entry
			try:
				forecast_entry = {
					'date': day_date,
					'day': (datetime.now() + timedelta(days=i+1)).strftime('%A'),
					'predicted_aqi': predicted_aqi,
					'air_quality_level': level,
					'level_color': color,
					'temperature': round(float(temp), 1),
					'humidity': int(humidity),
					'wind_speed': round(float(wind_speed), 1),
					'confidence': max(50, 85 - (i * 5))  # Decreasing confidence over time, min 50%
				}
				forecast_data.append(forecast_entry)
			except Exception as entry_err:
				print(f"Forecast entry error for day {i}: {entry_err}")
				# Add a minimal entry to keep 7 days
				forecast_data.append({
					'date': day_date,
					'day': (datetime.now() + timedelta(days=i+1)).strftime('%A'),
					'predicted_aqi': 75,  # Default moderate AQI
					'air_quality_level': 'Moderate',
					'level_color': '#ffff00',
					'temperature': 25.0,
					'humidity': 60,
					'wind_speed': 2.0,
					'confidence': 50
				})
		
		return jsonify({
			'success': True,
			'location': {'lat': lat, 'lon': lon},
			'forecast_days': len(forecast_data),
			'nasa_base_score': base_nasa_score,
			'data_sources': ['NASA_Satellite', 'OpenWeather_Forecast'],
			'forecast': forecast_data,
			'note': '7-day forecast with enhanced error handling'
		})
		
	except ValueError as ve:
		return jsonify({"error": f"Invalid coordinates: {str(ve)}"}), 400
	except Exception as e:
		print(f"7-day forecast error: {str(e)}")
		print(f"Error type: {type(e).__name__}")
		return jsonify({
			"error": f"7-day forecast failed: {str(e)}", 
			"error_type": type(e).__name__,
			"success": False
		}), 500


@api_bp.get("/nasa/24hour-hourly")
def get_nasa_24hour_hourly():
	"""Get 24-hour hourly weather and air quality prediction using real OpenWeather data"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		
		hourly_data = []
		
		# Get current NASA data as baseline for AQI
		try:
			nasa_data = nasa_client.get_comprehensive_analysis(lat, lon)
			base_nasa_score = nasa_data.get('combined_assessment', {}).get('overall_score', 50)
		except Exception:
			base_nasa_score = 50
			
		# Get real-time OpenWeather 5-day/3-hour forecast
		try:
			ow_forecast = fetch_openweather_forecast(lat, lon)
			forecast_list = ow_forecast.get('list', [])
		except Exception as e:
			print(f"Error fetching OpenWeather forecast: {e}")
			forecast_list = []
		
		# Get current air pollution data
		try:
			current_pollution = fetch_openweather_pollution(lat, lon)
			current_aqi_components = current_pollution.get('list', [{}])[0].get('components', {})
		except Exception:
			current_aqi_components = {}
		
		# If we have forecast data, use it
		if forecast_list:
			# Take first 8 items (24 hours of 3-hour forecasts)
			for i, forecast_item in enumerate(forecast_list[:8]):
				try:
					# Extract real weather data
					main_data = forecast_item.get('main', {})
					weather_data = forecast_item.get('weather', [{}])[0]
					wind_data = forecast_item.get('wind', {})
					clouds_data = forecast_item.get('clouds', {})
					
					temp = main_data.get('temp', 25.0)
					humidity = main_data.get('humidity', 60)
					pressure = main_data.get('pressure', 1013)
					wind_speed = wind_data.get('speed', 2.0)
					weather_condition = weather_data.get('main', 'Clear')
					weather_description = weather_data.get('description', 'clear sky')
					
					# Get forecast time
					dt = forecast_item.get('dt')
					forecast_time = datetime.fromtimestamp(dt) if dt else datetime.now() + timedelta(hours=i*3)
					hour_of_day = forecast_time.hour
					
					# Calculate realistic AQI based on weather conditions
					# Wind helps disperse pollutants, humidity can trap them
					wind_factor = max(0.5, min(2.0, 5.0 / max(0.1, wind_speed)))  # Higher wind = lower factor
					humidity_factor = 1.0 + (humidity - 50) / 200  # Higher humidity = slight increase
					
					# Rush hour factor (morning and evening)
					rush_hour_factor = 1.3 if hour_of_day in [7, 8, 9, 17, 18, 19] else 1.0
					
					# Weather condition impact
					weather_multiplier = 1.0
					if 'rain' in weather_description.lower():
						weather_multiplier = 0.7  # Rain cleans air
					elif 'cloud' in weather_description.lower():
						weather_multiplier = 1.1  # Clouds can trap pollutants
					elif 'clear' in weather_description.lower():
						weather_multiplier = 0.9  # Clear conditions with good dispersion
					
					predicted_aqi = int(base_nasa_score * wind_factor * humidity_factor * rush_hour_factor * weather_multiplier)
					predicted_aqi = max(10, min(300, predicted_aqi))
					
					# Determine AQI level and color
					if predicted_aqi <= 50:
						level = "Good"
						color = "#00e400"
					elif predicted_aqi <= 100:
						level = "Moderate"
						color = "#ffff00"
					elif predicted_aqi <= 150:
						level = "Unhealthy for Sensitive"
						color = "#ff7e00"
					elif predicted_aqi <= 200:
						level = "Unhealthy"
						color = "#ff0000"
					elif predicted_aqi <= 300:
						level = "Very Unhealthy"
						color = "#8f3f97"
					else:
						level = "Hazardous"
						color = "#7e0023"
					
					# Map weather condition to appropriate icon
					weather_icons = {
						'Clear': '☀️',
						'Clouds': '☁️',
						'Rain': '🌧️',
						'Drizzle': '🌦️',
						'Thunderstorm': '⛈️',
						'Snow': '❄️',
						'Mist': '🌫️',
						'Smoke': '💨',
						'Haze': '🌫️',
						'Dust': '🌪️',
						'Fog': '🌁',
						'Sand': '🌪️',
						'Ash': '🌋',
						'Squall': '💨',
						'Tornado': '🌪️'
					}
					weather_icon = weather_icons.get(weather_condition, '☀️')
					
					# Determine time period
					if 6 <= hour_of_day < 12:
						time_period = 'Morning'
					elif 12 <= hour_of_day < 18:
						time_period = 'Afternoon'
					elif 18 <= hour_of_day < 22:
						time_period = 'Evening'
					else:
						time_period = 'Night'
					
					hourly_entry = {
						'hour': i * 3,  # 0, 3, 6, 9, 12, 15, 18, 21
						'time': forecast_time.strftime('%H:%M'),
						'datetime': forecast_time.strftime('%Y-%m-%d %H:%M'),
						'temperature': round(temp, 1),
						'humidity': int(humidity),
						'wind_speed': round(wind_speed, 1),
						'pressure': round(pressure, 1),
						'weather_condition': weather_condition,
						'weather_description': weather_description,
						'weather_icon': weather_icon,
						'predicted_aqi': predicted_aqi,
						'air_quality_level': level,
						'level_color': color,
						'is_rush_hour': hour_of_day in [7, 8, 9, 17, 18, 19],
						'time_period': time_period,
						'clouds': clouds_data.get('all', 0)
					}
					
					hourly_data.append(hourly_entry)
					
				except Exception as item_error:
					print(f"Error processing forecast item {i}: {item_error}")
					continue
		
		# If no forecast data or not enough hours, fill with current conditions
		if len(hourly_data) < 8:
			print(f"Only got {len(hourly_data)} forecast items, using current conditions for remaining hours")
			try:
				current_weather = fetch_openweather_weather_by_coords(lat, lon)
				base_temp = current_weather.get('main', {}).get('temp', 25.0)
				base_humidity = current_weather.get('main', {}).get('humidity', 60)
				base_pressure = current_weather.get('main', {}).get('pressure', 1013)
				base_wind = current_weather.get('wind', {}).get('speed', 2.0)
				current_weather_condition = current_weather.get('weather', [{}])[0].get('main', 'Clear')
			except Exception:
				base_temp = 25.0
				base_humidity = 60
				base_pressure = 1013
				base_wind = 2.0
				current_weather_condition = 'Clear'
		
		return jsonify({
			'success': True,
			'location': {'lat': lat, 'lon': lon},
			'total_hours': len(hourly_data),
			'base_conditions': {
				'nasa_score': base_nasa_score
			},
			'hourly_forecast': hourly_data,
			'data_sources': ['OpenWeather_Forecast', 'NASA_Satellite'],
			'note': '24-hour real-time forecast using OpenWeather 3-hour interval data'
		})
		
	except ValueError as ve:
		return jsonify({"error": f"Invalid coordinates: {str(ve)}"}), 400
	except Exception as e:
		print(f"24-hour hourly prediction error: {str(e)}")
		return jsonify({
			"error": f"24-hour prediction failed: {str(e)}",
			"success": False
		}), 500


@api_bp.post("/ml/train-with-nasa")
def train_model_with_nasa():
	"""Train ML model using NASA satellite data features"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		model_name = request.args.get("model", "random_forest")
		
		# Get NASA comprehensive data
		nasa_data = nasa_client.get_comprehensive_analysis(lat, lon)
		
		if not nasa_data.get('success'):
			return jsonify({"error": "Failed to get NASA data for training"}), 400
		
		# Extract NASA ML features
		nasa_features = nasa_data['ml_features']
		
		# Combine with existing weather data
		ow_current = fetch_openweather_current(lat, lon)
		ow_forecast = fetch_openweather_forecast(lat, lon)
		
		# Create enhanced training data
		training_features = []
		
		# Generate multiple samples with NASA features
		for i in range(100):  # Generate 100 samples
			base_features = {
				"temp": 25 + np.random.normal(0, 5),
				"humidity": 60 + np.random.normal(0, 10),
				"pressure": 1013 + np.random.normal(0, 20),
				"wind_speed": 5 + np.random.exponential(2),
				"visibility": 10 + np.random.normal(0, 2),
				"hour": np.random.randint(0, 24),
				"day_of_week": np.random.randint(0, 7),
				"month": datetime.now().month,
				"season": (datetime.now().month % 12) // 3,
			}
			
			# Add NASA features
			base_features.update(nasa_features)
			
			# Calculate enhanced AQI based on NASA data
			base_aqi = 50
			base_aqi += nasa_features['nasa_air_quality_score'] * 0.5
			base_aqi += nasa_features['fire_risk_score'] * 20
			base_aqi -= nasa_features['precip_benefit'] * 15
			base_aqi += np.random.normal(0, 10)
			
			base_features['aqi'] = max(0, min(500, base_aqi))
			training_features.append(base_features)
		
		# Train model
		training_data = pd.DataFrame(training_features)
		prediction_model.train_models(training_data, target_column='aqi')
		prediction_model.save_model()
		
		# Get model performance
		model_info = prediction_model.get_model_info()
		
		return jsonify({
			"success": True,
			"message": f"Model trained with NASA satellite data",
			"training_data_size": len(training_data),
			"nasa_features_used": len(nasa_features),
			"model_performance": model_info.get(model_name, {}),
			"data_sources": ["NASA_MODIS", "NASA_GPM", "OpenWeather", "Synthetic"],
			"nasa_assessment": nasa_data['combined_assessment']
		})
		
	except Exception as e:
		return jsonify({"error": f"NASA model training failed: {str(e)}"}), 500


@api_bp.get("/ml/predict-with-nasa")
def predict_with_nasa():
	"""Make prediction using NASA satellite data"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		model_name = request.args.get("model", "random_forest")
		
		# Get NASA comprehensive data
		nasa_data = nasa_client.get_comprehensive_analysis(lat, lon)
		
		if not nasa_data.get('success'):
			return jsonify({"error": "Failed to get NASA data for prediction"}), 400
		
		# Get current weather
		ow_current = fetch_openweather_current(lat, lon)
		current_weather = extract_realtime_aqi_openweather(ow_current) or {}
		
		# Prepare input features
		input_data = {
			"temp": current_weather.get('temp', 25),
			"humidity": current_weather.get('humidity', 60),
			"pressure": current_weather.get('pressure', 1013),
			"wind_speed": current_weather.get('wind_speed', 5),
			"visibility": current_weather.get('visibility', 10),
			"hour": datetime.now().hour,
			"day_of_week": datetime.now().weekday(),
			"month": datetime.now().month,
			"season": (datetime.now().month % 12) // 3,
		}
		
		# Add NASA features
		input_data.update(nasa_data['ml_features'])
		
		# Make prediction
		if not prediction_model.trained_models:
			prediction_model.load_model()
		
		if not prediction_model.trained_models:
			return jsonify({"error": "No trained model available. Train with NASA data first."}), 400
		
		prediction = prediction_model.predict(input_data, model_name)
		
		return jsonify({
			"success": True,
			"prediction": round(prediction, 2),
			"model_used": model_name,
			"location": {"lat": lat, "lon": lon},
			"nasa_assessment": nasa_data['combined_assessment'],
			"data_sources": ["NASA_MODIS_Aerosol", "NASA_MODIS_Fire", "NASA_GPM_Precipitation", "OpenWeather"],
			"satellite_confidence": nasa_data['ml_features']['satellite_data_confidence'],
			"recommendation": nasa_data['combined_assessment']['recommendation'],
			"input_features": {k: v for k, v in input_data.items() if not k.startswith('nasa_')},  # Hide internal NASA features
			"nasa_features_summary": {
				"aerosol_optical_depth": nasa_data['ml_features']['nasa_aod'],
				"fire_risk": nasa_data['ml_features']['fire_risk_score'],
				"precipitation_benefit": nasa_data['ml_features']['precip_benefit'],
				"overall_nasa_score": nasa_data['ml_features']['nasa_air_quality_score']
			}
		})
		
	except Exception as e:
		return jsonify({"error": f"NASA prediction failed: {str(e)}"}), 500

@api_bp.post("/tempo/load-existing")
def load_existing_tempo():
	"""Load the existing TEMPO file from root directory"""
	try:
		existing_tempo_path = os.path.join(os.getcwd(), "TEMPO_NO2_L2_NRT_V02_20251003T224442Z_S013G03.nc")
		
		if not os.path.exists(existing_tempo_path):
			return jsonify({"error": "TEMPO file not found in root directory"}), 404
		
		# Process existing TEMPO file
		file_info = tempo_processor.read_tempo_file(existing_tempo_path)
		summary = tempo_processor.get_file_summary()
		
		return jsonify({
			"success": True,
			"file_info": file_info,
			"summary": summary,
			"message": f"Successfully loaded existing TEMPO file: TEMPO_NO2_L2_NRT_V02_20251003T224442Z_S013G03.nc"
		})
		
	except Exception as e:
		return jsonify({"error": f"TEMPO file loading failed: {str(e)}"}), 500


@api_bp.post("/tempo/upload")
def upload_tempo_file():
	"""Upload and process TEMPO NetCDF file"""
	try:
		if 'file' not in request.files:
			return jsonify({"error": "No file provided"}), 400
		
		file = request.files['file']
		if file.filename == '':
			return jsonify({"error": "No file selected"}), 400
		
		if not file.filename.lower().endswith('.nc'):
			return jsonify({"error": "Only NetCDF (.nc) files are supported"}), 400
		
		# Check if this is the existing TEMPO file in root directory
		existing_tempo_path = os.path.join(os.getcwd(), "TEMPO_NO2_L2_NRT_V02_20251003T224442Z_S013G03.nc")
		
		if file.filename == "TEMPO_NO2_L2_NRT_V02_20251003T224442Z_S013G03.nc" and os.path.exists(existing_tempo_path):
			# Use the existing file instead of uploading
			temp_path = existing_tempo_path
			print(f"Using existing TEMPO file: {temp_path}")
		else:
			# Save uploaded file temporarily with proper error handling
			try:
				import tempfile
				# Create a temporary directory in the system temp folder
				temp_dir = tempfile.mkdtemp(prefix="tempo_")
				temp_path = os.path.join(temp_dir, file.filename)
				file.save(temp_path)
				print(f"Saved uploaded file to: {temp_path}")
			except Exception as save_error:
				return jsonify({"error": f"Failed to save uploaded file: {str(save_error)}"}), 500
		
		# Process TEMPO file
		file_info = tempo_processor.read_tempo_file(temp_path)
		summary = tempo_processor.get_file_summary()
		
		return jsonify({
			"success": True,
			"file_info": file_info,
			"summary": summary,
			"message": f"Successfully processed TEMPO file: {file.filename}"
		})
		
	except Exception as e:
		return jsonify({"error": f"TEMPO file processing failed: {str(e)}"}), 500


@api_bp.get("/tempo/extract-data")
def extract_tempo_data():
	"""Extract NO2 data from loaded TEMPO file"""
	try:
		# Get optional geographic bounds
		lat_min = request.args.get('lat_min', type=float)
		lat_max = request.args.get('lat_max', type=float)
		lon_min = request.args.get('lon_min', type=float)
		lon_max = request.args.get('lon_max', type=float)
		
		lat_range = (lat_min, lat_max) if lat_min is not None and lat_max is not None else None
		lon_range = (lon_min, lon_max) if lon_min is not None and lon_max is not None else None
		
		# Extract data
		df = tempo_processor.extract_no2_data(lat_range, lon_range)
		
		# Convert to JSON-serializable format
		data_summary = {
			"total_observations": len(df),
			"no2_statistics": {
				"mean": float(df['no2_column'].mean()),
				"std": float(df['no2_column'].std()),
				"min": float(df['no2_column'].min()),
				"max": float(df['no2_column'].max())
			},
			"geographic_bounds": {
				"lat_min": float(df['latitude'].min()),
				"lat_max": float(df['latitude'].max()),
				"lon_min": float(df['longitude'].min()),
				"lon_max": float(df['longitude'].max())
			},
			"sample_data": df.head(10).to_dict('records')
		}
		
		return jsonify({
			"success": True,
			"data_summary": data_summary,
			"message": f"Extracted {len(df)} NO2 observations"
		})
		
	except Exception as e:
		return jsonify({"error": f"Data extraction failed: {str(e)}"}), 500


@api_bp.get("/tempo/ml-features")
def get_tempo_ml_features():
	"""Get ML features from TEMPO data for specific location"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		
		# Create ML features for target location
		features = tempo_processor.create_ml_features(target_location=(lat, lon))
		
		return jsonify({
			"success": True,
			"location": {"lat": lat, "lon": lon},
			"features": features,
			"feature_count": len(features)
		})
		
	except Exception as e:
		return jsonify({"error": f"Feature extraction failed: {str(e)}"}), 500


@api_bp.post("/tempo/train-model")
def train_model_with_tempo():
	"""Train ML model using TEMPO satellite data"""
	try:
		# Get parameters
		model_name = request.args.get("model", "random_forest")
		grid_size = float(request.args.get("grid_size", "0.1"))
		
		# Aggregate TEMPO data to grid
		aggregated_data = tempo_processor.aggregate_to_grid(grid_size)
		
		if len(aggregated_data) < 10:
			return jsonify({"error": "Insufficient TEMPO data for training (need at least 10 grid cells)"}), 400
		
		# Prepare training data for ML model
		training_features = []
		
		for _, row in aggregated_data.iterrows():
			obs_time = row.get('observation_time', datetime.now())
			month = obs_time.month if hasattr(obs_time, 'month') else datetime.now().month
			
			features = {
				"temp": 25,  # Default temperature (could be enhanced with meteorological data)
				"humidity": 60,
				"pressure": 1013,
				"wind_speed": 5,
				"visibility": 10,
				"no2": row['no2_mean'],
				"latitude": row['latitude'],
				"longitude": row['longitude'],
				"hour": row['hour'],
				"day_of_week": row['day_of_week'],
				"month": month,
				"season": (month % 12) // 3,  # 0=Winter, 1=Spring, 2=Summer, 3=Fall
				"no2_variability": row['no2_std'] / (row['no2_mean'] + 1e-6),
				"observation_density": min(row['no2_count'], 50),  # Cap at 50
				"aqi": row['aqi_mean']  # Target variable
			}
			training_features.append(features)
		
		# Train model
		training_data = pd.DataFrame(training_features)
		prediction_model.train_models(training_data, target_column='aqi')
		prediction_model.save_model()
		
		# Get model performance
		model_info = prediction_model.get_model_info()
		
		return jsonify({
			"success": True,
			"message": f"Model trained successfully with {len(training_data)} TEMPO observations",
			"training_data_size": len(training_data),
			"model_performance": model_info.get(model_name, {}),
			"grid_size": grid_size,
			"data_source": "TEMPO_satellite"
		})
		
	except Exception as e:
		return jsonify({"error": f"Model training failed: {str(e)}"}), 500


@api_bp.get("/tempo/predict")
def predict_with_tempo():
	"""Make prediction using TEMPO-trained model"""
	try:
		lat = float(request.args.get("lat", "28.6139"))
		lon = float(request.args.get("lon", "77.2090"))
		model_name = request.args.get("model", "random_forest")
		
		# Create features based on location and current TEMPO data
		tempo_features = tempo_processor.create_ml_features(target_location=(lat, lon))
		
		# Get observation time for temporal features
		obs_time = tempo_features.get('observation_time', datetime.now())
		if isinstance(obs_time, str):
			try:
				obs_time = datetime.fromisoformat(obs_time.replace('Z', '+00:00'))
			except:
				obs_time = datetime.now()
		elif not isinstance(obs_time, datetime):
			obs_time = datetime.now()
		
		month = obs_time.month
		
		# Prepare input for prediction
		input_data = {
			"temp": 25,
			"humidity": 60,
			"pressure": 1013,
			"wind_speed": 5,
			"visibility": 10,
			"no2": tempo_features.get('target_no2', tempo_features.get('no2_mean', 0)),
			"latitude": lat,
			"longitude": lon,
			"hour": tempo_features.get('hour', 12),
			"day_of_week": tempo_features.get('day_of_week', 1),
			"month": month,
			"season": (month % 12) // 3,  # 0=Winter, 1=Spring, 2=Summer, 3=Fall
			"no2_variability": tempo_features.get('no2_variability', 0.1),
			"observation_density": tempo_features.get('local_observations', 1)
		}
		
		# Make prediction
		if not prediction_model.trained_models:
			prediction_model.load_model()
		
		if not prediction_model.trained_models:
			return jsonify({"error": "No trained model available. Upload TEMPO data and train first."}), 400
		
		prediction = prediction_model.predict(input_data, model_name)
		
		return jsonify({
			"success": True,
			"prediction": round(prediction, 2),
			"model_used": model_name,
			"location": {"lat": lat, "lon": lon},
			"tempo_features": tempo_features,
			"input_features": input_data,
			"data_source": "TEMPO_satellite"
		})
		
	except Exception as e:
		return jsonify({"error": f"TEMPO prediction failed: {str(e)}"}), 500
