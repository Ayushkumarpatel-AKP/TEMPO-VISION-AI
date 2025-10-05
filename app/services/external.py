from __future__ import annotations

import datetime
from collections import defaultdict
from typing import Any, Dict, List, Tuple

import requests
from flask import current_app


def _get(url: str, timeout: int | None = None) -> Dict[str, Any] | List[Any] | None:
	try:
		resp = requests.get(url, timeout=timeout)
		if resp.status_code == 200:
			return resp.json()
	except Exception:
		return None
	return None

# -------------- OpenWeather AQI (forecast/current) --------------

def fetch_openweather_forecast(lat: float, lon: float) -> dict | None:
	key = current_app.config.get("OPENWEATHER_KEY")
	if not key:
		return None
	url = (
		f"http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={lat}&lon={lon}&appid={key}"
	)
	return _get(url, timeout=current_app.config.get("REQUEST_TIMEOUT_SECONDS"))


def fetch_openweather_weather_forecast(lat: float, lon: float, units: str = "metric") -> dict | None:
	"""Get 5-day weather forecast with 3-hour intervals"""
	key = current_app.config.get("OPENWEATHER_KEY")
	if not key:
		return None
	url = (
		f"http://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={key}&units={units}"
	)
	return _get(url, timeout=current_app.config.get("REQUEST_TIMEOUT_SECONDS"))


def fetch_openweather_current(lat: float, lon: float) -> dict | None:
	key = current_app.config.get("OPENWEATHER_KEY")
	if not key:
		return None
	url = (
		f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={key}"
	)
	return _get(url, timeout=current_app.config.get("REQUEST_TIMEOUT_SECONDS"))

# -------------- OpenWeather Weather (by city and coordinates) --------------

def fetch_openweather_weather_by_city(city: str, units: str = "metric") -> dict | None:
	key = current_app.config.get("OPENWEATHER_KEY")
	if not key:
		return None
	url = f"https://api.openweathermap.org/data/2.5/weather?units={units}&q={city}&appid={key}"
	return _get(url, timeout=current_app.config.get("REQUEST_TIMEOUT_SECONDS"))


def fetch_openweather_weather_by_coords(lat: float, lon: float, units: str = "metric") -> dict | None:
	key = current_app.config.get("OPENWEATHER_KEY")
	if not key:
		return None
	url = f"https://api.openweathermap.org/data/2.5/weather?units={units}&lat={lat}&lon={lon}&appid={key}"
	return _get(url, timeout=current_app.config.get("REQUEST_TIMEOUT_SECONDS"))

# -------------- Reverse Geolocation (ipapi.co) --------------

def fetch_revgeo_ip() -> dict | None:
	url = "https://ipapi.co/json/"
	return _get(url, timeout=current_app.config.get("REQUEST_TIMEOUT_SECONDS"))

# -------------- Processing helpers --------------

def summarize_openweather_to_daily_aqi(ow_data: dict | None, days: int = 7) -> List[Tuple[str, float]]:
	if not ow_data or "list" not in ow_data:
		return []
	date_to_values: Dict[str, List[int]] = defaultdict(list)
	for item in ow_data.get("list", []):
		ts = item.get("dt")
		main = item.get("main", {})
		aqi = main.get("aqi")
		if ts is None or aqi is None:
			continue
		date_str = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
		date_to_values[date_str].append(int(aqi))
	
	daily: List[Tuple[str, float]] = []
	for date_str in sorted(date_to_values.keys())[:days]:
		values = date_to_values[date_str]
		if not values:
			continue
		avg = sum(values) / len(values)
		daily.append((date_str, round(avg, 2)))
	return daily[:days]


def extract_ow_pollutants_from_list(list_obj: List[dict] | None) -> Dict[str, float]:
	if not list_obj:
		return {}
	entry = list_obj[0] or {}
	components = entry.get("components") or {}
	result: Dict[str, float] = {}
	for key in ["co","no","no2","o3","so2","pm2_5","pm10","nh3"]:
		val = components.get(key)
		if isinstance(val, (int, float)):
			result[key] = float(val)
	return result


def extract_ow_pollutants(ow_forecast: dict | None, ow_current: dict | None) -> Dict[str, float]:
	cur_list = (ow_current or {}).get("list") if ow_current else None
	if cur_list:
		res = extract_ow_pollutants_from_list(cur_list)
		if res:
			return res
	fc_list = (ow_forecast or {}).get("list") if ow_forecast else None
	return extract_ow_pollutants_from_list(fc_list)


def extract_realtime_aqi_openweather(ow_current: dict | None) -> Dict[str, Any] | None:
	try:
		lst = (ow_current or {}).get("list", []) if ow_current else []
		cur_aqi = (lst[0] or {}).get("main", {}).get("aqi") if lst else None
		if isinstance(cur_aqi, (int, float)):
			return {"source": "openweather_current", "aqi": float(cur_aqi), "scale": "OW_1_5"}
	except Exception:
		pass
	return None

# -------------- AQI (0–500) computation from components --------------

def _compute_subindex(val: float, breakpoints: List[Tuple[float, float, int, int]]) -> int | None:
	for Clow, Chigh, Ilow, Ihigh in breakpoints:
		if Clow <= val <= Chigh:
			# Linear scaling
			return round(((Ihigh - Ilow) / (Chigh - Clow)) * (val - Clow) + Ilow)
	return None

# US EPA breakpoints (µg/m³) for PM2.5 and PM10
_PM25_BP: List[Tuple[float, float, int, int]] = [
	(0.0, 12.0, 0, 50),
	(12.1, 35.4, 51, 100),
	(35.5, 55.4, 101, 150),
	(55.5, 150.4, 151, 200),
	(150.5, 250.4, 201, 300),
	(250.5, 350.4, 301, 400),
	(350.5, 500.4, 401, 500),
]
_PM10_BP: List[Tuple[float, float, int, int]] = [
	(0, 54, 0, 50),
	(55, 154, 51, 100),
	(155, 254, 101, 150),
	(255, 354, 151, 200),
	(355, 424, 201, 300),
	(425, 504, 301, 400),
	(505, 604, 401, 500),
]


def compute_aqi_from_components(components: Dict[str, float]) -> Dict[str, Any]:
	"""Compute 0–500 AQI using available components (PM2.5/PM10 supported now).
	Returns { overall: int|None, subindices: { pollutant: int } }.
	"""
	subindices: Dict[str, int] = {}
	overall: int | None = None

	pm25 = components.get("pm2_5")
	if isinstance(pm25, (int, float)):
		idx = _compute_subindex(float(pm25), _PM25_BP)
		if idx is not None:
			subindices["pm2_5"] = idx
			overall = idx if overall is None else max(overall, idx)

	pm10 = components.get("pm10")
	if isinstance(pm10, (int, float)):
		idx = _compute_subindex(float(pm10), _PM10_BP)
		if idx is not None:
			subindices["pm10"] = idx
			overall = idx if overall is None else max(overall, idx)

	return {"overall": overall, "subindices": subindices}
