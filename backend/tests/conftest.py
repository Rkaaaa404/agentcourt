"""Pytest global fixtures and setup."""

import os
import sys
from pathlib import Path

# Ensure backend directory is in python path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Ensure test runs in sandbox
os.environ["PAYPAL_ENV"] = "sandbox"
os.environ["PAYPAL_BASE_URL"] = "https://api-m.sandbox.paypal.com"
os.environ["PAYPAL_CLIENT_ID"] = "mock_client_id"
os.environ["PAYPAL_CLIENT_SECRET"] = "mock_client_secret"
os.environ["PAYPAL_MERCHANT_EMAIL"] = "merchant@sandbox.paypal.com"
os.environ["PAYPAL_BUYER_EMAIL"] = "buyer@sandbox.paypal.com"
os.environ["PAYPAL_WEBHOOK_ID"] = "mock_webhook_id"
