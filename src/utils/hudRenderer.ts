import { TargetFace, PTZState } from "../types";

export interface DrawOptions {
  showGazeRay: boolean;
  showLeadVector: boolean;
  showLandmarks: boolean;
  colorFilter: "normal" | "night_vision" | "thermal" | "tactical_grid";
}

export function drawTacticalHUD(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  targets: TargetFace[],
  ptz: PTZState,
  options: DrawOptions,
  timestamp: number
) {
  // Apply Vision Filter if requested
  if (options.colorFilter === "night_vision") {
    ctx.save();
    ctx.fillStyle = "rgba(0, 255, 68, 0.12)";
    ctx.fillRect(0, 0, width, height);
    // Scanlines
    ctx.strokeStyle = "rgba(0, 255, 68, 0.07)";
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  } else if (options.colorFilter === "thermal") {
    ctx.save();
    ctx.fillStyle = "rgba(255, 60, 0, 0.1)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (options.colorFilter === "tactical_grid") {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 200, 255, 0.08)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw Camera Center & Gimbal Reticle
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(16, 185, 129, 0.45)"; // emerald
  ctx.lineWidth = 1.5;

  // Center Crosshair
  const crossSize = 18;
  ctx.beginPath();
  ctx.moveTo(cx - crossSize, cy);
  ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + crossSize, cy);
  ctx.moveTo(cx, cy - crossSize);
  ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5);
  ctx.lineTo(cx, cy + crossSize);
  ctx.stroke();

  // Center Circle
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.setLineDash([3, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Compass / PTZ Horizon scale
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
  ctx.textAlign = "center";
  ctx.fillText(`PTZ PAN: ${ptz.panAngle > 0 ? "+" : ""}${ptz.panAngle.toFixed(1)}° | TILT: ${ptz.tiltAngle > 0 ? "+" : ""}${ptz.tiltAngle.toFixed(1)}°`, cx, cy + 50);

  ctx.restore();

  // Draw Each Target
  targets.forEach((target) => {
    const isLocked = target.lockState === "LOCKED";
    const isWatchlist = !!target.watchlistMatch;
    const isCritical = target.watchlistMatch?.category === "WANTED" || target.stareDurationSeconds > 4;

    // Tactical Colors
    let strokeColor = "#06b6d4"; // cyan (tracking)
    let fillColor = "rgba(6, 182, 212, 0.08)";
    if (isCritical) {
      strokeColor = "#ef4444"; // red (critical / wanted / intense stare)
      fillColor = "rgba(239, 68, 68, 0.12)";
    } else if (isWatchlist && target.watchlistMatch?.category === "VIP") {
      strokeColor = "#f59e0b"; // gold/amber for VIP
      fillColor = "rgba(245, 158, 11, 0.12)";
    } else if (isLocked) {
      strokeColor = "#10b981"; // emerald for locked
      fillColor = "rgba(16, 185, 129, 0.1)";
    }

    const bx = target.x;
    const by = target.y;
    const bw = target.width;
    const bh = target.height;
    const tcx = bx + bw / 2;
    const tcy = by + bh / 2;

    ctx.save();

    // 1. Target Bounding Box Background
    ctx.fillStyle = fillColor;
    ctx.fillRect(bx, by, bw, bh);

    // 2. High-Tech Corner Brackets
    const bracketLen = Math.min(24, bw * 0.28);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isLocked ? 2.5 : 1.5;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(bx, by + bracketLen);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + bracketLen, by);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(bx + bw - bracketLen, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + bracketLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(bx, by + bh - bracketLen);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + bracketLen, by + bh);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(bx + bw - bracketLen, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by + bh - bracketLen);
    ctx.stroke();

    // 3. Center Target Reticle & Rotating Scanner Ring (when locked)
    if (isLocked) {
      ctx.save();
      ctx.translate(tcx, tcy);
      ctx.rotate((timestamp / 800) % (Math.PI * 2));
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(bw, bh) * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Lead crosshair inside
      ctx.beginPath();
      ctx.arc(tcx, tcy, 3, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
    }

    // 4. Movement Lead Trajectory Vector
    if (options.showLeadVector && (Math.abs(target.vx) > 0.3 || Math.abs(target.vy) > 0.3)) {
      const leadX = tcx + target.vx * 16;
      const leadY = tcy + target.vy * 16;

      ctx.save();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.85)"; // amber vector
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(tcx, tcy);
      ctx.lineTo(leadX, leadY);
      ctx.stroke();

      // Vector Arrow head
      ctx.beginPath();
      ctx.arc(leadX, leadY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.restore();
    }

    // 5. Gaze / Head Pose Ray Projection
    if (options.showGazeRay) {
      ctx.save();
      const eyeLeftX = bx + bw * 0.35;
      const eyeRightX = bx + bw * 0.65;
      const eyeY = by + bh * 0.42;

      // Calculate gaze angle projection vector
      // yaw: negative = looking left, positive = looking right
      // pitch: negative = looking up, positive = looking down
      const gazeLength = target.isStaringAtCamera ? 130 : 90;
      const gazeRadX = (target.yaw * Math.PI) / 180;
      const gazeRadY = (target.pitch * Math.PI) / 180;

      const gazeVectorX = Math.sin(gazeRadX) * gazeLength;
      const gazeVectorY = Math.sin(gazeRadY) * gazeLength;

      // Laser color: bright magenta or red when staring at camera, bright cyan otherwise
      const laserColor = target.isStaringAtCamera ? "#ec4899" : "#38bdf8";

      // Draw eyes points
      ctx.fillStyle = laserColor;
      ctx.beginPath();
      ctx.arc(eyeLeftX, eyeY, 2.5, 0, Math.PI * 2);
      ctx.arc(eyeRightX, eyeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Laser lines from both eyes converging/projecting
      ctx.strokeStyle = laserColor;
      ctx.lineWidth = target.isStaringAtCamera ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(eyeLeftX, eyeY);
      ctx.lineTo(eyeLeftX + gazeVectorX, eyeY + gazeVectorY);
      ctx.moveTo(eyeRightX, eyeY);
      ctx.lineTo(eyeRightX + gazeVectorX, eyeY + gazeVectorY);
      ctx.stroke();

      // Gaze focal point dot
      const avgEyeX = (eyeLeftX + eyeRightX) / 2;
      const focalX = avgEyeX + gazeVectorX;
      const focalY = eyeY + gazeVectorY;

      ctx.beginPath();
      ctx.arc(focalX, focalY, target.isStaringAtCamera ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = laserColor;
      ctx.fill();

      if (target.isStaringAtCamera) {
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ec4899";
        ctx.textAlign = "center";
        ctx.fillText("DIRECT GAZE [LOCK ON CAMERA]", focalX, focalY - 8);
      }
      ctx.restore();
    }

    // 6. Target Info HUD Header & Badges
    ctx.save();
    // Top banner
    const bannerH = 20;
    ctx.fillStyle = strokeColor;
    ctx.fillRect(bx, by - bannerH, bw, bannerH);

    ctx.fillStyle = "#020617";
    ctx.font = "bold 10px 'JetBrains Mono', sans-serif";
    ctx.textAlign = "left";
    const headerTitle = isWatchlist
      ? `[!] ${target.watchlistMatch?.category}: ${target.watchlistMatch?.name.slice(0, 18)}`
      : `TARGET ${target.id} [${target.lockState}]`;
    ctx.fillText(headerTitle, bx + 4, by - 6);

    // Bottom Stats Tag
    const tagY = by + bh + 14;
    ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    const tagW = Math.max(bw, 140);
    const tagH = 46;
    ctx.fillRect(bx, by + bh + 2, tagW, tagH);
    ctx.strokeRect(bx, by + bh + 2, tagW, tagH);

    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    
    // Line 1: Gaze info
    let gazeThai = "มองตรง (Direct)";
    if (target.gazeDirection === "LEFT") gazeThai = "มองซ้าย (Left)";
    else if (target.gazeDirection === "RIGHT") gazeThai = "มองขวา (Right)";
    else if (target.gazeDirection === "UP") gazeThai = "มองขึ้น (Up)";
    else if (target.gazeDirection === "DOWN") gazeThai = "มองลง (Down)";

    ctx.fillText(`GAZE: ${gazeThai} (${target.yaw > 0 ? "+" : ""}${target.yaw.toFixed(0)}°)`, bx + 5, tagY);
    
    // Line 2: Stare duration & Dwell
    const stareText = target.isStaringAtCamera
      ? `STARE: ${target.stareDurationSeconds.toFixed(1)}s (ALERT!)`
      : `DWELL: ${target.dwellTimeSeconds.toFixed(0)}s`;
    ctx.fillStyle = target.isStaringAtCamera ? "#f43f5e" : "#94a3b8";
    ctx.fillText(stareText, bx + 5, tagY + 13);

    // Line 3: Distance & Watchlist Match Confidence
    ctx.fillStyle = "#38bdf8";
    const matchConfidence = target.watchlistMatch
      ? `MATCH: ${target.watchlistMatch.confidence}%`
      : `RNG: ${target.distanceMeters.toFixed(1)}m`;
    ctx.fillText(`${matchConfidence} | SPD: ${target.speed.toFixed(1)}m/s`, bx + 5, tagY + 26);

    ctx.restore();
  });
}
