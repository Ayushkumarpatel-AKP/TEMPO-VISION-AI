from app import create_app

# Create Flask app instance
app = create_app()

# This is the WSGI entry point for Vercel
# Vercel will use this 'app' variable
