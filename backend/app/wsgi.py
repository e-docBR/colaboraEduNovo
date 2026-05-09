"""WSGI entrypoint for production servers."""
from . import create_app

app = create_app()
