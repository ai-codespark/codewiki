"""
Cloudflare Worker entry point for DeepWiki Backend API.

This module serves as the entry point for deploying the FastAPI application
on Cloudflare Workers using Python Workers runtime.
"""

import os
import sys
from pathlib import Path

# Set production environment
os.environ["NODE_ENV"] = "production"

# Add the api directory to Python path
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

# Disable development features
os.environ["UVICORN_RELOAD"] = "false"

# Import the FastAPI app
from api.api import app

# Export the ASGI application for Cloudflare Workers
# Cloudflare Workers will handle the ASGI interface
application = app

# For compatibility with different Workers configurations
def handler(request):
    """
    Alternative handler function if needed by Cloudflare Workers runtime.

    Args:
        request: The incoming request object from Cloudflare Workers

    Returns:
        Response object compatible with Cloudflare Workers
    """
    return application(request)
