import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "ewaste.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        verified INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        status TEXT DEFAULT 'collecting',
        total_points INTEGER DEFAULT 0,
        pickup_id INTEGER,
        recycler_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        confidence REAL,
        points INTEGER,
        photo_path TEXT,
        batch_id INTEGER
    );
    """)
    conn.commit()
    conn.close()

def seed_demo_users():
    conn = get_conn()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count == 0:
        conn.executemany(
            "INSERT INTO users (name, role, verified) VALUES (?, ?, ?)",
            [
                ("Asha (collector)", "collector", 0),
                ("GreenMetal Recyclers", "recycler", 1),
                ("QuickScrap Traders", "recycler", 0),
                ("Ravi (pickup)", "pickup", 0),
            ],
        )
        conn.commit()
    conn.close()
