"""Blueprint aggregation for API v1."""
from flask import Flask

from .v1 import api_v1_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(api_v1_bp, url_prefix="/api/v1")
