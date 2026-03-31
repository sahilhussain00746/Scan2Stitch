# db.py — Scan2Stitch database layer (PostgreSQL on Render, SQLite fallback for local dev)
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
    return hashlib.sha256(pin.strip().encode()).hexdigest()


# ── Init tables ───────────────────────────────────────────────────────────

def init_db():
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
    Name + PIN se user dhundho.
    Mila toh dict return karo, nahi mila toh None.
    """
    pin_hash = _hash_pin(pin)
    conn = _get_conn()
    cur  = conn.cursor()

    try:
        if USE_POSTGRES:
            cur.execute(
                "SELECT id, name FROM users WHERE LOWER(name) = LOWER(%s) AND pin_hash = %s",
                (name.strip(), pin_hash)
            )
            row = cur.fetchone()
            return {"id": row[0], "name": row[1]} if row else None
        else:
            cur.execute(
                "SELECT id, name FROM users WHERE LOWER(name) = LOWER(?) AND pin_hash = ?",
                (name.strip(), pin_hash)
            )
            row = cur.fetchone()
            return dict(row) if row else None
    except Exception as e:
        print(f"[DB] find_user error: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def find_user_by_name(name: str):
    """
    Sirf naam se user check karo — PIN galat hai ya nahi batao.
    Returns True if name exists, False otherwise.
    """
    conn = _get_conn()
    cur  = conn.cursor()
    try:
        if USE_POSTGRES:
            cur.execute("SELECT id FROM users WHERE LOWER(name) = LOWER(%s)", (name.strip(),))
        else:
            cur.execute("SELECT id FROM users WHERE LOWER(name) = LOWER(?)", (name.strip(),))
        return cur.fetchone() is not None
    except Exception as e:
        print(f"[DB] find_user_by_name error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


def create_user(name: str, pin: str) -> dict:
    pin_hash = _hash_pin(pin)
    conn = _get_conn()
    cur  = conn.cursor()
    try:
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
        return {"id": user_id, "name": name.strip()}
    except Exception as e:
        print(f"[DB] create_user error: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ── Save measurement ──────────────────────────────────────────────────────

def save_measurement(session_id: str, height_cm: float, m: dict, user_id: int = None) -> int:
    warnings_str = "; ".join(m.get("pose_warnings", []))
    conn = _get_conn()
    cur  = conn.cursor()
    try:
        if USE_POSTGRES:
            cur.execute("""
                INSERT INTO measurements
                  (user_id, session_id, height_cm, shoulder, chest, waist, hip,
                   inseam, sleeve, torso, angles_used, warnings)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
            """, (
                user_id, session_id, height_cm,
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
                user_id, session_id, height_cm,
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
        return row_id
    except Exception as e:
        print(f"[DB] save_measurement error: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ── Get history ───────────────────────────────────────────────────────────

def get_history(session_id: str = None, limit: int = 10, user_id: int = None) -> list:
    """Last N measurements return karo — date format consistent hoga."""
    conn = _get_conn()
    cur  = conn.cursor()

    try:
        if USE_POSTGRES:
            # PostgreSQL
            if user_id:
                cur.execute("""
                    SELECT id, height_cm, shoulder, chest, waist, hip,
                           inseam, sleeve, torso, angles_used, warnings,
                           TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
                    FROM measurements
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (user_id, limit))
            elif session_id:
                cur.execute("""
                    SELECT id, height_cm, shoulder, chest, waist, hip,
                           inseam, sleeve, torso, angles_used, warnings,
                           TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
                    FROM measurements
                    WHERE session_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (session_id, limit))
            else:
                return []
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]

        else:
            # SQLite — strftime se consistent date format
            if user_id:
                cur.execute("""
                    SELECT id, height_cm, shoulder, chest, waist, hip,
                           inseam, sleeve, torso, angles_used, warnings,
                           strftime('%Y-%m-%d %H:%M', created_at) as created_at
                    FROM measurements
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (user_id, limit))
            elif session_id:
                cur.execute("""
                    SELECT id, height_cm, shoulder, chest, waist, hip,
                           inseam, sleeve, torso, angles_used, warnings,
                           strftime('%Y-%m-%d %H:%M', created_at) as created_at
                    FROM measurements
                    WHERE session_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (session_id, limit))
            else:
                return []
            rows = [dict(row) for row in cur.fetchall()]

        # None values ko None hi rehne do — frontend handle karega
        return rows

    except Exception as e:
        print(f"[DB] get_history error: {e}")
        return []
    finally:
        cur.close()
        conn.close()
