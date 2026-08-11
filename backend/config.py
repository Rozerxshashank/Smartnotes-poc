import os
from pathlib import Path

# By default, use ~/Documents/SmartNotes. Can be overridden via env var by Electron.
SMARTNOTES_DIR = os.environ.get("SMARTNOTES_DIR", str(Path.home() / "Documents" / "SmartNotes"))

def init_config():
    # Ensure the directory exists
    os.makedirs(SMARTNOTES_DIR, exist_ok=True)
