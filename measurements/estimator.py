# measurements/estimator.py  —  Scan2Stitch (mediapipe 0.10.33 compatible)
import base64
import math
from dataclasses import dataclass
from typing import Dict, List, Optional

import cv2
import numpy as np

# ── mediapipe 0.10.30+ compatible import ─────────────────────────────────
import mediapipe as mp
mp_pose = mp.solutions.pose
POSE_LANDMARK = mp_pose.PoseLandmark

VIS_THRESHOLD    = 0.55
CHEST_CORRECTION = 1.06
WAIST_CORRECTION = 1.08
HIP_CORRECTION   = 1.05


@dataclass
class Landmark2D:
    x: float
    y: float
    z: float
    visibility: float


class MeasurementError(Exception):
    pass


class PoseEstimator:
    def __init__(self, detection_confidence: float = 0.6, complexity: int = 2):
        self.pose = mp_pose.Pose(
            static_image_mode=True,
            model_complexity=complexity,
            enable_segmentation=False,
            min_detection_confidence=detection_confidence,
            min_tracking_confidence=detection_confidence,
        )

    @staticmethod
    def _decode_b64(data_url: str) -> np.ndarray:
        if "," not in data_url:
            raise MeasurementError("Invalid image data URL.")
        _, encoded = data_url.split(",", 1)
        buf = np.frombuffer(base64.b64decode(encoded), dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if img is None:
            raise MeasurementError("Could not decode image.")
        return img

    def _extract_landmarks(self, bgr: np.ndarray) -> List[Landmark2D]:
        h, w, _ = bgr.shape
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        result = self.pose.process(rgb)
        if not result.pose_landmarks:
            raise MeasurementError("Pose not detected. Make sure full body is visible.")
        out = []
        for lm in result.pose_landmarks.landmark:
            out.append(Landmark2D(x=lm.x*w, y=lm.y*h, z=lm.z*w, visibility=lm.visibility))
        return out

    @staticmethod
    def _dist(a: Landmark2D, b: Landmark2D) -> float:
        return math.hypot(b.x - a.x, b.y - a.y)

    @staticmethod
    def _visible(lm: Landmark2D) -> bool:
        return lm.visibility > VIS_THRESHOLD

    def _pixel_body_height(self, lms: List[Landmark2D]) -> float:
        nose  = lms[POSE_LANDMARK.NOSE.value]
        l_ear = lms[POSE_LANDMARK.LEFT_EAR.value]
        r_ear = lms[POSE_LANDMARK.RIGHT_EAR.value]
        top_y = nose.y
        for ear in (l_ear, r_ear):
            if self._visible(ear):
                top_y = min(top_y, ear.y)

        bottom_candidates = [lms[i] for i in [
            POSE_LANDMARK.LEFT_ANKLE.value, POSE_LANDMARK.RIGHT_ANKLE.value,
            POSE_LANDMARK.LEFT_HEEL.value,  POSE_LANDMARK.RIGHT_HEEL.value,
        ] if lms[i].visibility > 0.4]

        if not bottom_candidates:
            raise MeasurementError("Ankles not detected. Make sure full body is visible.")

        bottom_y  = max(lm.y for lm in bottom_candidates)
        top_y    -= (bottom_y - top_y) * 0.07
        height_px = bottom_y - top_y
        if height_px < 80:
            raise MeasurementError("Person too small in frame. Step further back.")
        return height_px

    def _depth_from_side(self, side_lms, side_px_to_cm, lm_a, lm_b, fallback_ratio, width_cm):
        a, b = side_lms[lm_a], side_lms[lm_b]
        if self._visible(a) and self._visible(b):
            depth_cm = abs(b.x - a.x) * side_px_to_cm
            if width_cm > 0 and 0.35 * width_cm < depth_cm < 1.1 * width_cm:
                return depth_cm
        return width_cm * fallback_ratio if width_cm > 0 else 0.0

    @staticmethod
    def _ellipse_circ(a: float, b: float) -> float:
        h = ((a - b) ** 2) / ((a + b) ** 2)
        return math.pi * (a + b) * (1 + (3 * h) / (10 + math.sqrt(4 - 3 * h)))

    def _check_pose(self, lms: List[Landmark2D], view: str = "front") -> List[str]:
        warnings = []

        # Side view ke liye sirf lean check karo — tilt/ankle ignore
        if view == "Side":
            nose    = lms[POSE_LANDMARK.NOSE.value]
            l_hip   = lms[POSE_LANDMARK.LEFT_HIP.value]
            r_hip   = lms[POSE_LANDMARK.RIGHT_HIP.value]
            vis_hip = l_hip if l_hip.visibility > r_hip.visibility else r_hip
            lean    = abs(nose.x - vis_hip.x) / max(abs(nose.y - vis_hip.y), 0.01)
            if lean > 0.25:
                warnings.append("Side view — leaning forward or backward, stand straight.")
            return warnings

        # Front / Back ke liye full check
        critical = [
            POSE_LANDMARK.NOSE,
            POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.RIGHT_SHOULDER,
            POSE_LANDMARK.LEFT_HIP,      POSE_LANDMARK.RIGHT_HIP,
            POSE_LANDMARK.LEFT_ANKLE,    POSE_LANDMARK.RIGHT_ANKLE,
        ]
        low_vis = [p.name for p in critical if lms[p.value].visibility < VIS_THRESHOLD]
        if low_vis:
            warnings.append(f"{view} view — low visibility: {', '.join(low_vis)}")

        ls = lms[POSE_LANDMARK.LEFT_SHOULDER.value]
        rs = lms[POSE_LANDMARK.RIGHT_SHOULDER.value]
        lh = lms[POSE_LANDMARK.LEFT_HIP.value]
        rh = lms[POSE_LANDMARK.RIGHT_HIP.value]

        if abs(ls.y - rs.y) / max(abs(ls.x - rs.x), 1) > 0.15:
            warnings.append(f"{view} view — shoulders tilted.")
        if abs(lh.y - rh.y) / max(abs(lh.x - rh.x), 1) > 0.15:
            warnings.append(f"{view} view — hips tilted.")
        return warnings

    def _validate_with_back(self, front_lms, back_lms, front_px_to_cm, back_px_to_cm):
        f_ls = front_lms[POSE_LANDMARK.LEFT_SHOULDER.value]
        f_rs = front_lms[POSE_LANDMARK.RIGHT_SHOULDER.value]
        b_ls = back_lms[POSE_LANDMARK.LEFT_SHOULDER.value]
        b_rs = back_lms[POSE_LANDMARK.RIGHT_SHOULDER.value]
        front_shoulder = self._dist(f_ls, f_rs) * front_px_to_cm
        back_shoulder  = self._dist(b_ls, b_rs) * back_px_to_cm

        f_lh = front_lms[POSE_LANDMARK.LEFT_HIP.value]
        f_rh = front_lms[POSE_LANDMARK.RIGHT_HIP.value]
        b_lh = back_lms[POSE_LANDMARK.LEFT_HIP.value]
        b_rh = back_lms[POSE_LANDMARK.RIGHT_HIP.value]
        front_hip = self._dist(f_lh, f_rh) * front_px_to_cm
        back_hip  = self._dist(b_lh, b_rh) * back_px_to_cm

        front_torso = abs((f_lh.y+f_rh.y)/2 - (f_ls.y+f_rs.y)/2) * front_px_to_cm
        back_torso  = abs((b_lh.y+b_rh.y)/2 - (b_ls.y+b_rs.y)/2) * back_px_to_cm

        return {
            "shoulder_width_cm": (front_shoulder + back_shoulder) / 2,
            "hip_width_cm":      front_hip * 0.4 + back_hip * 0.6,
            "torso_length_cm":   (front_torso + back_torso) / 2,
        }

    def calculate_measurements(
        self,
        front_image_b64: str,
        side_image_b64: str,
        height_cm: float,
        back_image_b64: Optional[str] = None,
    ) -> Dict:
        if not (100 <= height_cm <= 230):
            raise MeasurementError("Height must be between 100 cm and 230 cm.")

        front_img = self._decode_b64(front_image_b64)
        side_img  = self._decode_b64(side_image_b64)
        front_lms = self._extract_landmarks(front_img)
        side_lms  = self._extract_landmarks(side_img)

        front_px_to_cm = height_cm / self._pixel_body_height(front_lms)
        side_px_to_cm  = height_cm / self._pixel_body_height(side_lms)

        warnings  = self._check_pose(front_lms, "Front")
        warnings += self._check_pose(side_lms,  "Side")

        l_sho = front_lms[POSE_LANDMARK.LEFT_SHOULDER.value]
        r_sho = front_lms[POSE_LANDMARK.RIGHT_SHOULDER.value]
        l_hip = front_lms[POSE_LANDMARK.LEFT_HIP.value]
        r_hip = front_lms[POSE_LANDMARK.RIGHT_HIP.value]

        shoulder_width_cm = self._dist(l_sho, r_sho) * front_px_to_cm

        chest_width_cm = shoulder_width_cm * 0.97
        chest_depth_cm = self._depth_from_side(
            side_lms, side_px_to_cm,
            POSE_LANDMARK.LEFT_SHOULDER.value, POSE_LANDMARK.RIGHT_SHOULDER.value,
            0.62, chest_width_cm,
        )
        chest_circ_cm = self._ellipse_circ(chest_width_cm/2, chest_depth_cm/2) * CHEST_CORRECTION

        waist_lx = l_sho.x + (l_hip.x - l_sho.x) * 0.60
        waist_rx = r_sho.x + (r_hip.x - r_sho.x) * 0.60
        waist_width_cm = abs(waist_rx - waist_lx) * front_px_to_cm
        waist_depth_cm = self._depth_from_side(
            side_lms, side_px_to_cm,
            POSE_LANDMARK.LEFT_HIP.value, POSE_LANDMARK.RIGHT_HIP.value,
            0.78, waist_width_cm,
        )
        waist_circ_cm = self._ellipse_circ(waist_width_cm/2, waist_depth_cm/2) * WAIST_CORRECTION

        hip_width_cm = self._dist(l_hip, r_hip) * front_px_to_cm
        hip_depth_cm = self._depth_from_side(
            side_lms, side_px_to_cm,
            POSE_LANDMARK.LEFT_HIP.value, POSE_LANDMARK.RIGHT_HIP.value,
            0.85, hip_width_cm,
        )
        hip_circ_cm = self._ellipse_circ(hip_width_cm/2, hip_depth_cm/2) * HIP_CORRECTION

        torso_cm = round(((self._dist(l_sho, l_hip) + self._dist(r_sho, r_hip)) / 2) * front_px_to_cm, 1)

        def _leg(hip, knee_idx, ankle_idx):
            knee  = front_lms[knee_idx]
            ankle = front_lms[ankle_idx]
            if all(self._visible(x) for x in (hip, knee, ankle)):
                return (self._dist(hip, knee) + self._dist(knee, ankle)) * front_px_to_cm
            return None

        left_leg  = _leg(l_hip, POSE_LANDMARK.LEFT_KNEE.value,  POSE_LANDMARK.LEFT_ANKLE.value)
        right_leg = _leg(r_hip, POSE_LANDMARK.RIGHT_KNEE.value, POSE_LANDMARK.RIGHT_ANKLE.value)
        if left_leg and right_leg:
            inseam_cm = round((left_leg + right_leg) / 2, 1)
        elif left_leg or right_leg:
            inseam_cm = round((left_leg or right_leg), 1)
        else:
            inseam_cm = None

        def _arm(s_idx, e_idx, w_idx):
            s, e, w = front_lms[s_idx], front_lms[e_idx], front_lms[w_idx]
            if all(self._visible(x) for x in (s, e, w)):
                return (self._dist(s, e) + self._dist(e, w)) * front_px_to_cm
            return None

        ls = _arm(POSE_LANDMARK.LEFT_SHOULDER.value,  POSE_LANDMARK.LEFT_ELBOW.value,  POSE_LANDMARK.LEFT_WRIST.value)
        rs = _arm(POSE_LANDMARK.RIGHT_SHOULDER.value, POSE_LANDMARK.RIGHT_ELBOW.value, POSE_LANDMARK.RIGHT_WRIST.value)
        if ls and rs:
            sleeve_cm = round((ls + rs) / 2, 1)
        elif ls or rs:
            sleeve_cm = round((ls or rs), 1)
        else:
            sleeve_cm = None

        # ── Back image cross-validation ───────────────────────────────────
        has_back = False
        if back_image_b64:
            try:
                back_img      = self._decode_b64(back_image_b64)
                back_lms      = self._extract_landmarks(back_img)
                back_px_to_cm = height_cm / self._pixel_body_height(back_lms)
                warnings     += self._check_pose(back_lms, "Back")

                v = self._validate_with_back(front_lms, back_lms, front_px_to_cm, back_px_to_cm)
                shoulder_width_cm = v["shoulder_width_cm"]
                hip_width_cm      = v["hip_width_cm"]
                torso_cm          = round(v["torso_length_cm"], 1)

                chest_width_cm = shoulder_width_cm * 0.97
                chest_circ_cm  = self._ellipse_circ(chest_width_cm/2, chest_depth_cm/2) * CHEST_CORRECTION
                hip_circ_cm    = self._ellipse_circ(hip_width_cm/2,   hip_depth_cm/2)   * HIP_CORRECTION
                has_back = True
            except MeasurementError:
                warnings.append("Back image could not be processed — using front+side only.")

        return {
            "shoulder_width_cm":      round(shoulder_width_cm, 1),
            "chest_circumference_cm": round(chest_circ_cm, 1),
            "waist_circumference_cm": round(waist_circ_cm, 1),
            "hip_circumference_cm":   round(hip_circ_cm, 1),
            "inseam_cm":              inseam_cm,
            "sleeve_length_cm":       sleeve_cm,
            "torso_length_cm":        torso_cm,
            "angles_used":            3 if has_back else 2,
            "pose_warnings":          warnings,
            "debug": {
                "front_px_to_cm": round(front_px_to_cm, 4),
                "side_px_to_cm":  round(side_px_to_cm, 4),
                "chest_width_cm": round(chest_width_cm, 2),
                "chest_depth_cm": round(chest_depth_cm, 2),
                "waist_width_cm": round(waist_width_cm, 2),
                "waist_depth_cm": round(waist_depth_cm, 2),
                "hip_width_cm":   round(hip_width_cm, 2),
                "hip_depth_cm":   round(hip_depth_cm, 2),
            },
        }
