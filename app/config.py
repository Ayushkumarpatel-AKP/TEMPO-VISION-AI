import os
from dotenv import load_dotenv

# Load .env if present
load_dotenv()


class Config:
	OPENWEATHER_KEY: str | None = os.getenv("OPENWEATHER_KEY")
	WAQI_TOKEN: str | None = os.getenv("WAQI_TOKEN")
	GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
	TEMPO_TOKEN: str | None = os.getenv("TEMPO_TOKEN")
	# Optional: rate limits, timeouts
	REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15"))


