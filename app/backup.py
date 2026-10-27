"""Copy the live database to a backup file.

Usage (inside the container):  python -m app.backup /data/backup.db
"""

import os
import sys

from .store import Store

if __name__ == "__main__":
    dest = sys.argv[1] if len(sys.argv) > 1 else "/data/backup.db"
    Store(os.environ.get("DB_PATH", "party.db")).backup(dest)
    print(f"Backed up to {dest}")
