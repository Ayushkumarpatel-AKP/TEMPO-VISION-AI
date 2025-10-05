from flask import Flask
from .config import Config


def create_app() -> Flask:
	app = Flask(__name__, static_folder="../static", template_folder="../templates")
	app.config.from_object(Config)

	# Enable CORS manually
	@app.after_request
	def after_request(response):
		response.headers.add('Access-Control-Allow-Origin', '*')
		response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
		response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
		return response

	# Register routes
	from .routes import api_bp, pages_bp
	app.register_blueprint(api_bp, url_prefix="/api")
	app.register_blueprint(pages_bp)

	return app


