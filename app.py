# app.py
import os
import uuid
from flask import Flask, jsonify, render_template, request, session

from db import init_db, find_user, find_user_by_name, create_user, save_measurement, get_history
from measurements.estimator import MeasurementError, PoseEstimator

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")

pose_estimator = PoseEstimator()

with app.app_context():
    init_db()


# ── Pages ─────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


# ── Auth ──────────────────────────────────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    pin  = (data.get("pin")  or "").strip()

    if not name:
        return jsonify({"success": False, "error": "Name is required."}), 400
    if not pin or len(pin) != 4 or not pin.isdigit():
        return jsonify({"success": False, "error": "PIN must be exactly 4 digits."}), 400

    user   = find_user(name, pin)
    is_new = False

    if user is None:
        # Naam exist karta hai? Toh PIN galat hai
        if find_user_by_name(name):
            return jsonify({
                "success": False,
                "error":   "Incorrect PIN for this name. Try again."
            }), 401

        # Bilkul naya user
        try:
            user   = create_user(name, pin)
            is_new = True
        except Exception as e:
            return jsonify({"success": False, "error": f"Could not create account: {e}"}), 500

    session["user_id"]   = user["id"]
    session["user_name"] = user["name"]
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())

    history = get_history(
        session_id=session["session_id"],
        user_id=user["id"],
        limit=10
    )

    return jsonify({
        "success":     True,
        "user_name":   user["name"],
        "is_new_user": is_new,
        "history":     history,
    })


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True})


# ── Measurements ──────────────────────────────────────────────────────────

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
            front_image_b64=data["frontImage"],
            side_image_b64 =data["sideImage"],
            height_cm      =height_cm,
            back_image_b64 =data.get("backImage"),
        )
    except MeasurementError as exc:
        return jsonify({"success": False, "error": str(exc)}), 422
    except Exception as exc:
        return jsonify({"success": False, "error": f"Unexpected error: {exc}"}), 500

    # DB save
    try:
        session_id = session.get("session_id") or str(uuid.uuid4())
        if "session_id" not in session:
            session["session_id"] = session_id
        save_measurement(session_id, height_cm, measurements, user_id=session.get("user_id"))
    except Exception as e:
        print(f"[app] save_measurement failed: {e}")

    return jsonify({"success": True, "measurements": measurements})


@app.route("/api/history", methods=["GET"])
def api_history():
    user_id    = session.get("user_id")
    session_id = session.get("session_id", "")
    if not user_id and not session_id:
        return jsonify({"success": True, "history": []})
    history = get_history(session_id=session_id, user_id=user_id, limit=10)
    return jsonify({"success": True, "history": history})


if __name__ == "__main__":
    app.run(debug=True)
