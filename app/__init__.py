from flask import Flask
from flask_cors import CORS
from .config import Config


def create_app() -> Flask:
	app = Flask(__name__, static_folder="../static", template_folder="../templates")
	app.config.from_object(Config)

	CORS(app)

	# Register routes
	from .routes import api_bp, pages_bp
	app.register_blueprint(api_bp, url_prefix="/api")
	app.register_blueprint(pages_bp)

	return app


