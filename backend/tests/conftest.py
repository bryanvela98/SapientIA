import sys
from pathlib import Path

# Make `app.*` imports work when pytest is run from anywhere.
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# Load .env for integration tests that hit the real API.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(_BACKEND / ".env")