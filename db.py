# db.py — Scan2Stitch database layer (PostgreSQL for Render, SQLite fallback for local)
import os
import hashlib
import sqlite3
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_POSTGRES = bool(DATABASE_URL)

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


# ── Connection ────────────────────────────────────────────────────────────

def _get_conn():
    if USE_POSTGRES:
        return psycopg2.connect(DATABASE_URL)
    else:
        db_path = os.path.join(os.path.dirname(__file__), "scan2stitch.db")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn


# ── PIN hashing ───────────────────────────────────────────────────────────

def _hash_pin(pin: str) -> str:
    """Simple SHA-256 hash for PIN storage."""
    return hashlib.sha256(pin.strip().encode()).hexdigest()


# ── Init tables ───────────────────────────────────────────────────────────

def init_db():
    """App start hone pe tables create karo agar exist nahi karti."""
    conn = _get_conn()
    cur  = conn.cursor()

    if USE_POSTGRES:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          SERIAL PRIMARY KEY,
                name        TEXT NOT NULL,
                pin_hash    TEXT NOT NULL,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS measurements (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id),
                session_id  TEXT,
                height_cm   REAL,
                shoulder    REAL,
                chest       REAL,
                waist       REAL,
                hip         REAL,
                inseam      REAL,
                sleeve      REAL,
                torso       REAL,
                angles_used INTEGER,
                warnings    TEXT,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """)
    else:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                pin_hash    TEXT NOT NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS measurements (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER REFERENCES users(id),
                session_id  TEXT,
                height_cm   REAL,
                shoulder    REAL,
                chest       REAL,
                waist       REAL,
                hip         REAL,
                inseam      REAL,
                sleeve      REAL,
                torso       REAL,
                angles_used INTEGER,
                warnings    TEXT,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

    conn.commit()
    cur.close()
    conn.close()
    print(f"[DB] Using {'PostgreSQL' if USE_POSTGRES else 'SQLite'}. Tables ready.")


# ── User management ───────────────────────────────────────────────────────

def find_user(name: str, pin: str):
    """
    Name + PIN se user dhundo.
    Returns user dict agar mila, warna None.
    """
    pin_hash = _hash_pin(pin)
    conn = _get_conn()
    cur  = conn.cursor()

    if USE_POSTGRES:
        cur.execute(
            "SELECT id, name FROM users WHERE LOWER(name) = LOWER(%s) AND pin_hash = %s",
            (name.strip(), pin_hash)
        )
        row = cur.fetchone()
        result = {"id": row[0], "name": row[1]} if row else None
    else:
        cur.execute(
            "SELECT id, name FROM users WHERE LOWER(name) = LOWER(?) AND pin_hash = ?",
            (name.strip(), pin_hash)
        )
        row = cur.fetchone()
        result = dict(row) if row else None

    cur.close()
    conn.close()
    return result


def create_user(name: str, pin: str) -> dict:
    """
    Naya user banao.
    Returns {"id": ..., "name": ...}
    """
    pin_hash = _hash_pin(pin)
    conn = _get_conn()
    cur  = conn.cursor()

    if USE_POSTGRES:
        cur.execute(
            "INSERT INTO users (name, pin_hash) VALUES (%s, %s) RETURNING id",
            (name.strip(), pin_hash)
        )
        user_id = cur.fetchone()[0]
    else:
        cur.execute(
            "INSERT INTO users (name, pin_hash) VALUES (?, ?)",
            (name.strip(), pin_hash)
        )
        user_id = cur.lastrowid

    conn.commit()
    cur.close()
    conn.close()
    return {"id": user_id, "name": name.strip()}


# ── Save measurement ──────────────────────────────────────────────────────

def save_measurement(session_id: str, height_cm: float, m: dict, user_id: int = None) -> int:
    """
    Measurement save karo. Returns inserted row id.
    """
    warnings_str = "; ".join(m.get("pose_warnings", []))

    conn = _get_conn()
    cur  = conn.cursor()

    if USE_POSTGRES:
        cur.execute("""
            INSERT INTO measurements
              (user_id, session_id, height_cm, shoulder, chest, waist, hip,
               inseam, sleeve, torso, angles_used, warnings)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            user_id,
            session_id,
            height_cm,
            m.get("shoulder_width_cm"),
            m.get("chest_circumference_cm"),
            m.get("waist_circumference_cm"),
            m.get("hip_circumference_cm"),
            m.get("inseam_cm"),
            m.get("sleeve_length_cm"),
            m.get("torso_length_cm"),
            m.get("angles_used"),
            warnings_str,
        ))
        row_id = cur.fetchone()[0]
    else:
        cur.execute("""
            INSERT INTO measurements
              (user_id, session_id, height_cm, shoulder, chest, waist, hip,
               inseam, sleeve, torso, angles_used, warnings)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            user_id,
            session_id,
            height_cm,
            m.get("shoulder_width_cm"),
            m.get("chest_circumference_cm"),
            m.get("waist_circumference_cm"),
            m.get("hip_circumference_cm"),
            m.get("inseam_cm"),
            m.get("sleeve_length_cm"),
            m.get("torso_length_cm"),
            m.get("angles_used"),
            warnings_str,
        ))
        row_id = cur.lastrowid

    conn.commit()
    cur.close()
    conn.close()
    return row_id


# ── Get history ───────────────────────────────────────────────────────────

def get_history(session_id: str, limit: int = 10, user_id: int = None) -> list:
    """User ki last N measurements wapas karo."""
    conn = _get_conn()
    cur  = conn.cursor()

    if USE_POSTGRES:
        if user_id:
            cur.execute("""
                SELECT id, height_cm, shoulder, chest, waist, hip,
                       inseam, sleeve, torso, angles_used, warnings, created_at
                FROM measurements
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (user_id, limit))
        else:
            cur.execute("""
                SELECT id, height_cm, shoulder, chest, waist, hip,
                       inseam, sleeve, torso, angles_used, warnings, created_at
                FROM measurements
                WHERE session_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (session_id, limit))
        rows = [dict(zip([d[0] for d in cur.description], row)) for row in cur.fetchall()]
    else:
        if user_id:
            cur.execute("""
                SELECT id, height_cm, shoulder, chest, waist, hip,
                       inseam, sleeve, torso, angles_used, warnings, created_at
                FROM measurements
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
        else:
            cur.execute("""
                SELECT id, height_cm, shoulder, chest, waist, hip,
                       inseam, sleeve, torso, angles_used, warnings, created_at
                FROM measurements
                WHERE session_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (session_id, limit))
        rows = [dict(row) for row in cur.fetchall()]

    cur.close()
    conn.close()
    return rows