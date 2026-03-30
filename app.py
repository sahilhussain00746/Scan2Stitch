# app.py — Scan2Stitch
import uuid
from flask import Flask, jsonify, render_template, request, session
from measurements.estimator import MeasurementError, PoseEstimator
from db import init_db, save_measurement, get_history, find_user, create_user

app = Flask(__name__)
app.secret_key = "change-this-in-production-use-env-var"

pose_estimator = PoseEstimator()

with app.app_context():
    init_db()


# ── Session helper ────────────────────────────────────────────────────────

def get_session_id() -> str:
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())
    return session["session_id"]


# ── Routes ────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


# ── Auth: Login ya Register ───────────────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def api_login():
    """
    Name + PIN se user dhundo.
    - Mila → user info + measurements history return karo
    - Nahi mila → naya user banao
    """
    try:
        data = request.get_json(force=True)
    except Exception as exc:
        return jsonify({"success": False, "error": f"Invalid JSON: {exc}"}), 400

    name = (data.get("name") or "").strip()
    pin  = str(data.get("pin") or "").strip()

    if not name:
        return jsonify({"success": False, "error": "Naam zaroor bharo."}), 400
    if len(pin) != 4 or not pin.isdigit():
        return jsonify({"success": False, "error": "PIN 4 digits ka hona chahiye."}), 400

    user = find_user(name, pin)

    if user:
        # Returning user — session mein save karo
        session["user_id"]   = user["id"]
        session["user_name"] = user["name"]
        sid      = get_session_id()
        history  = get_history(sid, limit=10, user_id=user["id"])

        return jsonify({
            "success":      True,
            "is_new_user":  False,
            "user_name":    user["name"],
            "history":      history,
        })
    else:
        # New user — register karo
        new_user = create_user(name, pin)
        session["user_id"]   = new_user["id"]
        session["user_name"] = new_user["name"]
        get_session_id()

        return jsonify({
            "success":     True,
            "is_new_user": True,
            "user_name":   new_user["name"],
            "history":     [],
        })


# ── Logout ────────────────────────────────────────────────────────────────

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True})


# ── Measure ───────────────────────────────────────────────────────────────

@app.route("/api/measure", methods=["POST"])
def api_measure():
    try:
        data = request.get_json(force=True)
    except Exception as exc:
        return jsonify({"success": False, "error": f"Invalid JSON: {exc}"}), 400

    required = ["frontImage", "sideImage", "heightCm"]
    missing  = [f for f in required if f not in data]
    if missing:
        return jsonify({"success": False, "error": f"Missing: {', '.join(missing)}"}), 400

    try:
        height_cm = float(data["heightCm"])
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "heightCm must be a number."}), 400

    try:
        measurements = pose_estimator.calculate_measurements(
            front_image_b64 = data["frontImage"],
            side_image_b64  = data["sideImage"],
            height_cm       = height_cm,
            back_image_b64  = data.get("backImage"),
        )
    except MeasurementError as exc:
        return jsonify({"success": False, "error": str(exc)}), 422
    except Exception as exc:
        return jsonify({"success": False, "error": f"Unexpected error: {exc}"}), 500

    try:
        sid     = get_session_id()
        user_id = session.get("user_id")
        row_id  = save_measurement(sid, height_cm, measurements, user_id=user_id)
        measurements["record_id"] = row_id
    except Exception as exc:
        app.logger.error(f"DB save failed: {exc}")

    return jsonify({"success": True, "measurements": measurements})


# ── History ───────────────────────────────────────────────────────────────

@app.route("/api/history", methods=["GET"])
def api_history():
    try:
        sid     = get_session_id()
        user_id = session.get("user_id")
        records = get_history(sid, limit=20, user_id=user_id)
        return jsonify({"success": True, "history": records})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True)