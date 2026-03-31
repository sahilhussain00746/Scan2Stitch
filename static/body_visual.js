// static/body_visual.js  —  Scan2Stitch  (realistic figure + animated lines)

function drawBodyVisual(data) {
  const container = document.getElementById("bodyVisualContainer");
  if (!container) return;
  container.innerHTML = "";
  container.style.display = "block";

  const canvas = document.createElement("canvas");
  canvas.width  = 420;
  canvas.height = 620;
  canvas.style.cssText = "width:100%;max-width:420px;display:block;margin:0 auto;border-radius:16px;";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2;

  // ── Anatomy constants ─────────────────────────────────────────────────
  const Y = {
    headTop:  28, headBot: 96, chin: 102, neck: 112,
    shoulder: 136, armpit: 158,
    chest:    185, waist: 248, hip: 308,
    crotch:   336, knee: 448, ankle: 548, floor: 572,
  };
  const X = {
    shoulder: 82, chest: 70, waist: 50, hip: 72,
    thigh: 38, knee: 28, calf: 22, ankle: 16,
    arm: 18, elbow: 16, wrist: 13,
  };

  // ── Background gradient ───────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f0f4ff");
  bg.addColorStop(1, "#e8edf8");
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, W, H, 16);
  ctx.fill();

  // ── Draw figure ───────────────────────────────────────────────────────
  function bodyPath() {
    ctx.beginPath();
    // Left side top → bottom
    ctx.moveTo(cx - 10, Y.chin);
    ctx.quadraticCurveTo(cx - 22, Y.neck, cx - 30, Y.neck + 10);
    ctx.lineTo(cx - X.shoulder, Y.shoulder);
    // shoulder → chest curve
    ctx.bezierCurveTo(cx - X.shoulder - 10, Y.shoulder + 14,
                      cx - X.chest - 8,    Y.armpit,
                      cx - X.chest,        Y.chest);
    // chest → waist
    ctx.bezierCurveTo(cx - X.chest + 6,  Y.chest + 30,
                      cx - X.waist - 4,  Y.waist - 18,
                      cx - X.waist,      Y.waist);
    // waist → hip
    ctx.bezierCurveTo(cx - X.waist - 2, Y.waist + 20,
                      cx - X.hip + 4,   Y.hip - 16,
                      cx - X.hip,       Y.hip);
    // hip → crotch
    ctx.bezierCurveTo(cx - X.hip - 2, Y.hip + 14,
                      cx - X.thigh - 4, Y.crotch - 8,
                      cx - X.thigh,    Y.crotch);
    // left leg
    ctx.bezierCurveTo(cx - X.thigh - 2, Y.crotch + 40,
                      cx - X.knee - 4,  Y.knee - 50,
                      cx - X.knee,      Y.knee);
    ctx.bezierCurveTo(cx - X.knee,     Y.knee + 16,
                      cx - X.calf - 2, Y.ankle - 50,
                      cx - X.calf,     Y.ankle);
    ctx.bezierCurveTo(cx - X.calf,     Y.ankle + 10,
                      cx - X.ankle,    Y.floor - 10,
                      cx - X.ankle,    Y.floor);
    // feet bottom
    ctx.lineTo(cx - X.ankle - 6, Y.floor);
    ctx.lineTo(cx, Y.floor + 6);
    ctx.lineTo(cx + X.ankle + 6, Y.floor);
    // right leg
    ctx.lineTo(cx + X.ankle,  Y.floor);
    ctx.bezierCurveTo(cx + X.ankle,  Y.floor - 10,
                      cx + X.calf,   Y.ankle + 10,
                      cx + X.calf,   Y.ankle);
    ctx.bezierCurveTo(cx + X.calf + 2, Y.ankle - 50,
                      cx + X.knee,     Y.knee + 16,
                      cx + X.knee,     Y.knee);
    ctx.bezierCurveTo(cx + X.knee + 4, Y.knee - 50,
                      cx + X.thigh + 2, Y.crotch + 40,
                      cx + X.thigh,    Y.crotch);
    // crotch → hip
    ctx.bezierCurveTo(cx + X.thigh + 4, Y.crotch - 8,
                      cx + X.hip + 2,   Y.hip + 14,
                      cx + X.hip,       Y.hip);
    // hip → waist
    ctx.bezierCurveTo(cx + X.hip - 4,  Y.hip - 16,
                      cx + X.waist + 2, Y.waist + 20,
                      cx + X.waist,     Y.waist);
    // waist → chest
    ctx.bezierCurveTo(cx + X.waist + 4, Y.waist - 18,
                      cx + X.chest - 6, Y.chest + 30,
                      cx + X.chest,     Y.chest);
    // chest → shoulder
    ctx.bezierCurveTo(cx + X.chest + 8, Y.armpit,
                      cx + X.shoulder + 10, Y.shoulder + 14,
                      cx + X.shoulder, Y.shoulder);
    ctx.lineTo(cx + 30, Y.neck + 10);
    ctx.quadraticCurveTo(cx + 22, Y.neck, cx + 10, Y.chin);
    ctx.closePath();
  }

  function armPath(side) {
    const s = side === "L" ? -1 : 1;
    const sx = cx + s * X.shoulder, sy = Y.shoulder;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + s * 14, sy + 20,
                      sx + s * 20, Y.chest + 20,
                      sx + s * 18, Y.waist - 16);
    ctx.bezierCurveTo(sx + s * 16, Y.waist + 10,
                      sx + s * 12, Y.hip - 10,
                      sx + s * 10, Y.hip + 10);
    ctx.bezierCurveTo(sx + s * 4,  Y.hip - 8,
                      sx - s * 2,  Y.waist,
                      sx - s * 4,  Y.shoulder + 10);
    ctx.closePath();
  }

  // ── Skin gradient ─────────────────────────────────────────────────────
  const skinGrad = ctx.createLinearGradient(cx - X.shoulder - 20, Y.headTop, cx + X.shoulder + 20, H);
  skinGrad.addColorStop(0,   "#f8dcc8");
  skinGrad.addColorStop(0.4, "#f0c9a8");
  skinGrad.addColorStop(1,   "#e8bc98");

  // Draw arms first (behind body)
  ["L","R"].forEach(side => {
    armPath(side);
    ctx.fillStyle   = skinGrad;
    ctx.fill();
    ctx.strokeStyle = "#d4a882";
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  });

  // Body fill
  bodyPath();
  ctx.fillStyle = skinGrad;
  ctx.fill();

  // Body shading — left side darker
  const shadeGrad = ctx.createLinearGradient(cx - X.shoulder - 10, 0, cx + X.shoulder + 10, 0);
  shadeGrad.addColorStop(0,    "rgba(0,0,0,0.08)");
  shadeGrad.addColorStop(0.35, "rgba(0,0,0,0)");
  shadeGrad.addColorStop(0.65, "rgba(0,0,0,0)");
  shadeGrad.addColorStop(1,    "rgba(0,0,0,0.06)");
  bodyPath();
  ctx.fillStyle = shadeGrad;
  ctx.fill();

  // Body outline
  bodyPath();
  ctx.strokeStyle = "#c4956a";
  ctx.lineWidth   = 1.8;
  ctx.stroke();

  // ── Head ──────────────────────────────────────────────────────────────
  // Neck
  ctx.beginPath();
  ctx.moveTo(cx - 14, Y.chin);
  ctx.bezierCurveTo(cx - 16, Y.neck - 4, cx - 14, Y.neck, cx - 10, Y.neck + 8);
  ctx.lineTo(cx + 10, Y.neck + 8);
  ctx.bezierCurveTo(cx + 14, Y.neck, cx + 16, Y.neck - 4, cx + 14, Y.chin);
  ctx.closePath();
  ctx.fillStyle = skinGrad;
  ctx.fill();
  ctx.strokeStyle = "#c4956a";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Head shape
  ctx.beginPath();
  ctx.ellipse(cx, (Y.headTop + Y.headBot) / 2 + 2, 34, 36, 0, 0, Math.PI * 2);
  ctx.fillStyle = skinGrad;
  ctx.fill();
  ctx.strokeStyle = "#c4956a";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Hair
  ctx.beginPath();
  ctx.ellipse(cx, Y.headTop + 16, 35, 24, 0, Math.PI, 0);
  ctx.fillStyle = "#2c1a0e";
  ctx.fill();
  // Hair detail lines
  ctx.strokeStyle = "#3d2510";
  ctx.lineWidth = 1;
  [-12,-4,4,12].forEach(ox => {
    ctx.beginPath();
    ctx.moveTo(cx + ox, Y.headTop + 2);
    ctx.quadraticCurveTo(cx + ox + 3, Y.headTop + 18, cx + ox + 1, Y.headTop + 38);
    ctx.stroke();
  });

  // Eyes
  ctx.fillStyle = "#fff";
  [-11, 11].forEach(ox => {
    ctx.beginPath();
    ctx.ellipse(cx + ox, Y.headTop + 40, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
  ctx.fillStyle = "#3d2510";
  [-11, 11].forEach(ox => {
    ctx.beginPath();
    ctx.arc(cx + ox, Y.headTop + 40, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#fff";
  [-9, 13].forEach(ox => {
    ctx.beginPath();
    ctx.arc(cx + ox, Y.headTop + 38, 1, 0, Math.PI * 2);
    ctx.fill();
  });

  // Eyebrows
  ctx.strokeStyle = "#2c1a0e";
  ctx.lineWidth = 1.8;
  [-11, 11].forEach(ox => {
    ctx.beginPath();
    ctx.moveTo(cx + ox - 6, Y.headTop + 34);
    ctx.quadraticCurveTo(cx + ox, Y.headTop + 32, cx + ox + 6, Y.headTop + 34);
    ctx.stroke();
  });

  // Nose
  ctx.strokeStyle = "#c4956a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, Y.headTop + 44);
  ctx.lineTo(cx - 4, Y.headTop + 56);
  ctx.lineTo(cx - 2, Y.headTop + 57);
  ctx.moveTo(cx - 4, Y.headTop + 56);
  ctx.quadraticCurveTo(cx, Y.headTop + 59, cx + 4, Y.headTop + 56);
  ctx.lineTo(cx + 2, Y.headTop + 57);
  ctx.stroke();

  // Mouth
  ctx.beginPath();
  ctx.moveTo(cx - 8, Y.headTop + 64);
  ctx.bezierCurveTo(cx - 4, Y.headTop + 68, cx + 4, Y.headTop + 68, cx + 8, Y.headTop + 64);
  ctx.strokeStyle = "#b07050";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // ── Measurement lines (animated) ──────────────────────────────────────
  const measurements = [
    {
      label:  "Shoulder",
      value:  data.shoulder_width_cm,
      y:      Y.shoulder,
      lx:     cx - X.shoulder,
      rx:     cx + X.shoulder,
      color:  "#1565c0",
      side:   "right",
      labelX: cx + X.shoulder + 14,
    },
    {
      label:  "Chest",
      value:  data.chest_circumference_cm,
      y:      Y.chest,
      lx:     cx - X.chest,
      rx:     cx + X.chest,
      color:  "#b71c1c",
      side:   "right",
      labelX: cx + X.chest + 14,
    },
    {
      label:  "Waist",
      value:  data.waist_circumference_cm,
      y:      Y.waist,
      lx:     cx - X.waist,
      rx:     cx + X.waist,
      color:  "#e65100",
      side:   "right",
      labelX: cx + X.waist + 14,
    },
    {
      label:  "Hip",
      value:  data.hip_circumference_cm,
      y:      Y.hip,
      lx:     cx - X.hip,
      rx:     cx + X.hip,
      color:  "#6a1b9a",
      side:   "right",
      labelX: cx + X.hip + 14,
    },
    {
      label:  "Inseam",
      value:  data.inseam_cm,
      y:      (Y.crotch + Y.ankle) / 2,
      lx:     cx - X.thigh,
      rx:     cx - X.thigh,
      color:  "#00695c",
      side:   "left",
      labelX: cx - X.thigh - 14,
      vertical: true,
      y1: Y.crotch, y2: Y.ankle,
    },
    {
      label:  "Sleeve",
      value:  data.sleeve_length_cm,
      y:      Y.shoulder + 60,
      lx:     cx - X.shoulder - 16,
      rx:     cx - X.shoulder - 16,
      color:  "#37474f",
      side:   "left",
      labelX: cx - X.shoulder - 28,
      vertical: true,
      y1: Y.shoulder, y2: Y.shoulder + 120,
    },
    {
      label:  "Torso",
      value:  data.torso_length_cm,
      y:      (Y.shoulder + Y.hip) / 2,
      lx:     cx - X.shoulder - 36,
      rx:     cx - X.shoulder - 36,
      color:  "#4527a0",
      side:   "left",
      labelX: cx - X.shoulder - 48,
      vertical: true,
      y1: Y.shoulder, y2: Y.hip,
    },
  ];

  // Animate lines drawing in sequence
  let lineIndex = 0;
  let lineProgress = 0; // 0 → 1
  const LINE_SPEED = 0.06;

  function animateLines() {
    if (lineIndex >= measurements.length) {
      // All done — draw all static
      measurements.forEach(m => { if (m.value) drawMeasureLine(m, 1, true); });
      return;
    }

    const m = measurements[lineIndex];
    if (!m.value) { lineIndex++; animateLines(); return; }

    lineProgress += LINE_SPEED;
    if (lineProgress > 1) lineProgress = 1;

    // Redraw background (body) — just the measurement layer
    // We draw on top, so clear only measurement area softly via globalCompositeOperation
    measurements.forEach((mm, i) => {
      if (i < lineIndex && mm.value) drawMeasureLine(mm, 1, true);
    });
    drawMeasureLine(m, lineProgress, false);

    if (lineProgress >= 1) {
      lineProgress = 0;
      lineIndex++;
    }
    requestAnimationFrame(animateLines);
  }

  function drawMeasureLine(m, progress, showLabel) {
    if (!m.value) return;
    ctx.save();
    ctx.strokeStyle = m.color;
    ctx.fillStyle   = m.color;
    ctx.lineWidth   = 1.5;

    if (m.vertical) {
      // Vertical inseam/torso/sleeve line
      const y1  = m.y1;
      const y2  = m.y1 + (m.y2 - m.y1) * progress;
      const lx  = m.lx;

      // Tick top
      ctx.beginPath();
      ctx.moveTo(lx - 5, y1); ctx.lineTo(lx + 5, y1);
      ctx.stroke();
      // Vertical line
      ctx.beginPath();
      ctx.setLineDash([4, 3]);
      ctx.moveTo(lx, y1); ctx.lineTo(lx, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (progress >= 1) {
        // Tick bottom
        ctx.beginPath();
        ctx.moveTo(lx - 5, m.y2); ctx.lineTo(lx + 5, m.y2);
        ctx.stroke();
      }
    } else {
      // Horizontal line
      const y  = m.y;
      const lx = m.lx;
      const rx = m.lx + (m.rx - m.lx) * progress;

      // Left tick
      ctx.beginPath();
      ctx.moveTo(lx, y - 5); ctx.lineTo(lx, y + 5);
      ctx.stroke();
      // Horizontal dashed
      ctx.beginPath();
      ctx.setLineDash([5, 3]);
      ctx.moveTo(lx, y); ctx.lineTo(rx, y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (progress >= 1) {
        // Right tick
        ctx.beginPath();
        ctx.moveTo(m.rx, y - 5); ctx.lineTo(m.rx, y + 5);
        ctx.stroke();
        // Leader to label
        ctx.beginPath();
        ctx.setLineDash([2, 3]);
        ctx.moveTo(m.side === "right" ? m.rx : m.lx, y);
        ctx.lineTo(m.labelX, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (showLabel || progress >= 1) {
      const labelText = `${m.label}`;
      const valText   = `${m.value} cm`;

      ctx.font         = "bold 10px sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign    = m.side === "right" ? "left" : "right";

      const lx2 = m.labelX + (m.side === "right" ? 4 : -4);
      const ly  = m.vertical ? (m.y1 + m.y2) / 2 : m.y;

      // Pill background
      const tw = Math.max(ctx.measureText(labelText).width, ctx.measureText(valText).width) + 10;
      const pillX = m.side === "right" ? lx2 - 4 : lx2 - tw + 4;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle   = m.color;
      ctx.beginPath();
      ctx.roundRect(pillX, ly - 12, tw, 24, 5);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#fff";
      ctx.font      = "600 9px sans-serif";
      ctx.fillText(labelText, lx2, ly - 4);
      ctx.font      = "bold 11px sans-serif";
      ctx.fillText(valText,   lx2, ly + 6);
    }

    ctx.restore();
  }

  // ── Accuracy badge ────────────────────────────────────────────────────
  const angles     = data.angles_used || 2;
  const badgeColor = angles === 3 ? "#2e7d32" : "#1565c0";
  const badgeText  = angles === 3 ? "✓ 3-angle scan" : "2-angle scan";
  ctx.font         = "bold 11px sans-serif";
  const bw         = ctx.measureText(badgeText).width + 20;
  ctx.fillStyle    = badgeColor;
  ctx.globalAlpha  = 0.92;
  ctx.beginPath();
  ctx.roundRect(W / 2 - bw / 2, H - 30, bw, 22, 7);
  ctx.fill();
  ctx.globalAlpha  = 1;
  ctx.fillStyle    = "#fff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, W / 2, H - 19);

  // ── Start animation ───────────────────────────────────────────────────
  requestAnimationFrame(animateLines);
}
