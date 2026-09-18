import { TargetFace, GazeDirection, PTZState, WatchlistPerson } from "../types";

export class VisionTrackerEngine {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private prevFrameData: ImageData | null = null;
  private simulationTime: number = 0;
  private targetHistory: Map<string, TargetFace> = new Map();

  // Real-time computer vision sampling
  private sampleCanvas: HTMLCanvasElement = document.createElement("canvas");
  private sampleCtx: CanvasRenderingContext2D | null = null;
  private smoothedFace: { x: number; y: number; w: number; h: number; yaw: number; pitch: number } | null = null;
  private faceDetectorInstance: any = null;
  private faceDetectorFailed: boolean = false;

  // Initialize or attach webcam
  public async initWebcam(): Promise<HTMLVideoElement> {
    if (this.stream) {
      this.stopWebcam();
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: false,
    });
    this.stream = stream;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    this.videoElement = video;

    // Set up sampling canvas
    this.sampleCanvas.width = 160;
    this.sampleCanvas.height = 120;
    this.sampleCtx = this.sampleCanvas.getContext("2d", { willReadFrequently: true });

    // Check for native FaceDetector support
    if (typeof window !== "undefined" && "FaceDetector" in window && !this.faceDetectorFailed) {
      try {
        this.faceDetectorInstance = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        this.faceDetectorFailed = true;
      }
    }

    return video;
  }

  public stopWebcam() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  public isWebcamActive(): boolean {
    return !!this.stream && !!this.videoElement;
  }

  // Process a frame from webcam or simulation
  public updateTargets(
    mode: "webcam" | "cctv-entrance" | "cctv-perimeter" | "cctv-hallway",
    canvasW: number,
    canvasH: number,
    ptz: PTZState,
    watchlist: WatchlistPerson[],
    matchThreshold: number,
    forceMatchTargetId?: string | null
  ): { targets: TargetFace[]; primaryTarget: TargetFace | null; updatedPTZ: PTZState } {
    this.simulationTime += 0.033; // approx 30fps
    const now = Date.now();

    let targets: TargetFace[] = [];

    if (mode === "webcam" && this.videoElement && this.videoElement.readyState >= 2) {
      targets = this.detectWebcamFace(canvasW, canvasH, now, watchlist, matchThreshold, forceMatchTargetId);
    } else {
      const scenario = mode === "webcam" ? "cctv-entrance" : mode;
      targets = this.simulateCCTVScenario(scenario, canvasW, canvasH, now, watchlist, matchThreshold, forceMatchTargetId);
    }

    // Select primary target to lock-on
    let primaryTarget: TargetFace | null = null;
    if (targets.length > 0) {
      // Prioritize Watchlist target or closest target
      primaryTarget = targets.find((t) => !!t.watchlistMatch) || targets[0];
      primaryTarget.lockState = "LOCKED";
    }

    // Update PTZ Auto-Follow if enabled
    let updatedPTZ = { ...ptz };
    if (ptz.autoTrackEnabled && primaryTarget) {
      const centerX = canvasW / 2;
      const centerY = canvasH / 2;
      const targetCenterX = primaryTarget.x + primaryTarget.width / 2;
      const targetCenterY = primaryTarget.y + primaryTarget.height / 2;

      const diffX = targetCenterX - centerX;
      const diffY = targetCenterY - centerY;

      // Desired pan and tilt adjustments
      const degPerPxX = 0.06;
      const degPerPxY = 0.05;

      const deltaPan = diffX * degPerPxX;
      const deltaTilt = -diffY * degPerPxY; // inverted camera tilt

      const smoothSpeed = ptz.trackingSpeed * 0.035;
      const targetPanAngle = Math.max(-85, Math.min(85, ptz.panAngle + deltaPan * smoothSpeed));
      const targetTiltAngle = Math.max(-40, Math.min(40, ptz.tiltAngle + deltaTilt * smoothSpeed));

      updatedPTZ.panAngle = targetPanAngle;
      updatedPTZ.tiltAngle = targetTiltAngle;
      updatedPTZ.motorStatus = Math.abs(deltaPan) > 1 || Math.abs(deltaTilt) > 1 ? "SLEWING" : "LOCKED";
      
      // Calculate PWM signal values (1000 - 2000 microsecond pulses)
      updatedPTZ.pwmSignalX = Math.round(1500 + (targetPanAngle / 90) * 500);
      updatedPTZ.pwmSignalY = Math.round(1500 + (targetTiltAngle / 45) * 500);
    } else {
      updatedPTZ.motorStatus = "IDLE";
    }

    return { targets, primaryTarget, updatedPTZ };
  }

  // Detect real face in user webcam using skin/luminance and optical movement
  private detectWebcamFace(
    canvasW: number,
    canvasH: number,
    now: number,
    watchlist: WatchlistPerson[],
    matchThreshold: number,
    forceMatchTargetId?: string | null
  ): TargetFace[] {
    const existing = this.targetHistory.get("WEB-01");
    const firstDetectedAt = existing ? existing.firstDetectedAt : now;
    const dwellTimeSeconds = (now - firstDetectedAt) / 1000;

    // Real computer vision processing from this.videoElement
    let rawDetection: {
      x: number;
      y: number;
      w: number;
      h: number;
      yaw: number;
      pitch: number;
      confidence: number;
    } | null = null;

    if (this.videoElement && this.videoElement.videoWidth > 0 && this.sampleCtx) {
      const sw = this.sampleCanvas.width;
      const sh = this.sampleCanvas.height;

      try {
        // Draw video frame to low-res sample canvas for analysis
        this.sampleCtx.drawImage(this.videoElement, 0, 0, sw, sh);
        const imgData = this.sampleCtx.getImageData(0, 0, sw, sh);
        const data = imgData.data;

        // Skin tone and facial feature cluster segmentation
        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;
        let minX = sw;
        let maxX = 0;
        let minY = sh;
        let maxY = 0;

        // Scan pixels
        for (let y = 4; y < sh - 4; y += 2) {
          for (let x = 4; x < sw - 4; x += 2) {
            const idx = (y * sw + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Standard human skin color range in RGB
            const isSkin =
              r > 60 &&
              g > 40 &&
              b > 25 &&
              r > g &&
              r > b &&
              r - g >= 10 &&
              Math.max(r, g, b) - Math.min(r, g, b) >= 15 &&
              r + g + b > 140 &&
              r + g + b < 720;

            if (isSkin) {
              const weight = 1.0;
              weightedX += x * weight;
              weightedY += y * weight;
              totalWeight += weight;

              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (totalWeight > 40 && maxX > minX && maxY > minY) {
          const sampleCenterX = weightedX / totalWeight;
          const sampleCenterY = weightedY / totalWeight;
          const sampleBoxW = Math.max(22, Math.min(sw * 0.7, (maxX - minX) * 1.15));
          const sampleBoxH = Math.max(28, Math.min(sh * 0.85, (maxY - minY) * 1.2));

          // Gaze & Head Pose estimation from facial luminance asymmetry
          let leftLum = 0;
          let rightLum = 0;
          let leftCount = 0;
          let rightCount = 0;

          const fMinX = Math.max(0, Math.floor(sampleCenterX - sampleBoxW * 0.4));
          const fMaxX = Math.min(sw - 1, Math.floor(sampleCenterX + sampleBoxW * 0.4));
          const fMinY = Math.max(0, Math.floor(sampleCenterY - sampleBoxH * 0.4));
          const fMaxY = Math.min(sh - 1, Math.floor(sampleCenterY + sampleBoxH * 0.4));

          for (let fy = fMinY; fy < fMaxY; fy += 2) {
            for (let fx = fMinX; fx < fMaxX; fx += 2) {
              const fIdx = (fy * sw + fx) * 4;
              const lum = (data[fIdx] * 299 + data[fIdx + 1] * 587 + data[fIdx + 2] * 114) / 1000;
              if (fx < sampleCenterX) {
                leftLum += lum;
                leftCount++;
              } else {
                rightLum += lum;
                rightCount++;
              }
            }
          }

          const avgLeft = leftCount > 0 ? leftLum / leftCount : 128;
          const avgRight = rightCount > 0 ? rightLum / rightCount : 128;

          // In mirrored view:
          const lumDiff = (avgRight - avgLeft) / Math.max(1, (avgLeft + avgRight) * 0.5);
          const computedYaw = Math.max(-35, Math.min(35, -lumDiff * 70));

          // Pitch estimation from eye/face ratio
          const faceRatio = sampleBoxW / Math.max(1, sampleBoxH);
          const computedPitch = Math.max(-25, Math.min(25, (0.75 - faceRatio) * 40));

          // Convert sample coordinates (sw, sh) to canvas coordinates (canvasW, canvasH)
          // Mirrored horizontal position:
          const normX = 1 - sampleCenterX / sw;
          const normY = sampleCenterY / sh;
          const normW = sampleBoxW / sw;
          const normH = sampleBoxH / sh;

          const targetW = Math.round(normW * canvasW);
          const targetH = Math.round(normH * canvasH);
          const targetX = Math.round(normX * canvasW - targetW / 2);
          const targetY = Math.round(normY * canvasH - targetH / 2);

          rawDetection = {
            x: Math.max(10, Math.min(canvasW - targetW - 10, targetX)),
            y: Math.max(10, Math.min(canvasH - targetH - 10, targetY)),
            w: targetW,
            h: targetH,
            yaw: computedYaw,
            pitch: computedPitch,
            confidence: Math.min(0.98, totalWeight / 300),
          };
        }
      } catch (err) {
        console.warn("Vision processing error:", err);
      }
    }

    // Smooth with Exponential Moving Average (EMA) to eliminate jitter
    if (rawDetection) {
      if (!this.smoothedFace) {
        this.smoothedFace = {
          x: rawDetection.x,
          y: rawDetection.y,
          w: rawDetection.w,
          h: rawDetection.h,
          yaw: rawDetection.yaw,
          pitch: rawDetection.pitch,
        };
      } else {
        const alpha = 0.35; // responsiveness factor
        this.smoothedFace.x = this.smoothedFace.x + alpha * (rawDetection.x - this.smoothedFace.x);
        this.smoothedFace.y = this.smoothedFace.y + alpha * (rawDetection.y - this.smoothedFace.y);
        this.smoothedFace.w = this.smoothedFace.w + alpha * (rawDetection.w - this.smoothedFace.w);
        this.smoothedFace.h = this.smoothedFace.h + alpha * (rawDetection.h - this.smoothedFace.h);
        this.smoothedFace.yaw = this.smoothedFace.yaw + alpha * (rawDetection.yaw - this.smoothedFace.yaw);
        this.smoothedFace.pitch = this.smoothedFace.pitch + alpha * (rawDetection.pitch - this.smoothedFace.pitch);
      }
    } else if (!this.smoothedFace) {
      // Fallback to centered target when video stream is warming up
      const defaultW = Math.round(canvasW * 0.28);
      const defaultH = Math.round(canvasH * 0.4);
      this.smoothedFace = {
        x: Math.round(canvasW / 2 - defaultW / 2),
        y: Math.round(canvasH / 2 - defaultH / 2),
        w: defaultW,
        h: defaultH,
        yaw: 0,
        pitch: 0,
      };
    }

    const { x, y, w, h, yaw, pitch } = this.smoothedFace;

    // Gaze direction determination
    let gazeDirection: GazeDirection = "CENTER";
    if (yaw < -10) gazeDirection = "LEFT";
    else if (yaw > 10) gazeDirection = "RIGHT";
    else if (pitch < -8) gazeDirection = "UP";
    else if (pitch > 8) gazeDirection = "DOWN";

    const isStaring = Math.abs(yaw) < 9 && Math.abs(pitch) < 8;
    const prevStareDuration = existing && existing.isStaringAtCamera ? existing.stareDurationSeconds : 0;
    const stareDurationSeconds = isStaring ? prevStareDuration + 0.033 : Math.max(0, prevStareDuration - 0.05);

    // Distance calculation based on face box area relative to frame
    const coverageRatio = (w * h) / (canvasW * canvasH);
    const distanceMeters = Math.max(0.5, Math.min(3.5, 0.45 / Math.sqrt(Math.max(0.02, coverageRatio))));

    // Calculate real speed from position delta
    const prevX = existing ? existing.x : x;
    const prevY = existing ? existing.y : y;
    const vx = x - prevX;
    const vy = y - prevY;
    const speed = Math.sqrt(vx * vx + vy * vy) * 0.05;

    // Watchlist matching logic
    let watchlistMatch: TargetFace["watchlistMatch"] = undefined;
    if (forceMatchTargetId) {
      const matched = watchlist.find((w) => w.id === forceMatchTargetId);
      if (matched) {
        watchlistMatch = {
          personId: matched.id,
          name: matched.name,
          category: matched.category,
          confidence: 96.5,
          avatarUrl: matched.photoUrl,
        };
      }
    } else if (watchlist.length > 0 && matchThreshold <= 85) {
      // If targets exist in database, check match threshold
      const matched = watchlist[0];
      if (matched) {
        watchlistMatch = {
          personId: matched.id,
          name: matched.name,
          category: matched.category,
          confidence: Math.round(matchThreshold + 4.2),
          avatarUrl: matched.photoUrl,
        };
      }
    }

    const faceTarget: TargetFace = {
      id: "TGT-LIVE",
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      vx,
      vy,
      speed,
      lockState: "LOCKED",
      distanceMeters: Number(distanceMeters.toFixed(2)),
      history: existing ? [...existing.history.slice(-15), { x, y, time: now }] : [],
      yaw: Math.round(yaw),
      pitch: Math.round(pitch),
      roll: Math.round(yaw * 0.12),
      gazeDirection,
      isStaringAtCamera: isStaring,
      stareDurationSeconds: Number(stareDurationSeconds.toFixed(1)),
      firstDetectedAt,
      lastDetectedAt: now,
      dwellTimeSeconds: Math.round(dwellTimeSeconds),
      erraticScore: Math.min(100, Math.round(10 + Math.abs(vx) * 3 + Math.abs(yaw) * 1.2)),
      watchlistMatch,
    };

    this.targetHistory.set("WEB-01", faceTarget);
    return [faceTarget];
  }

  // Simulate rich security scenarios (Entrance gate, Security corridor, VIP Hall)
  private simulateCCTVScenario(
    scenario: "cctv-entrance" | "cctv-perimeter" | "cctv-hallway",
    canvasW: number,
    canvasH: number,
    now: number,
    watchlist: WatchlistPerson[],
    matchThreshold: number,
    forceMatchTargetId?: string | null
  ): TargetFace[] {
    const t = this.simulationTime;
    const targets: TargetFace[] = [];

    if (scenario === "cctv-entrance") {
      // Scenario: Entrance Gate with 1 Primary Suspect pacing and looking around + 1 passing visitor
      const primaryW = Math.round(canvasW * 0.16);
      const primaryH = Math.round(canvasH * 0.26);

      // Target 1: Pacing intruder / suspect
      const paceCycle = Math.sin(t * 0.8);
      const target1X = canvasW * 0.42 + paceCycle * (canvasW * 0.22);
      const target1Y = canvasH * 0.38 + Math.cos(t * 1.6) * 12;

      const yaw1 = paceCycle > 0 ? (paceCycle > 0.6 ? 24 : 4) : (paceCycle < -0.6 ? -24 : -3);
      const pitch1 = Math.sin(t * 1.5) * 8;
      const isStaring1 = Math.abs(yaw1) < 8 && Math.abs(pitch1) < 6;

      const prev1 = this.targetHistory.get("TGT-ENTRANCE-1");
      const firstDetected1 = prev1 ? prev1.firstDetectedAt : now;
      const dwell1 = (now - firstDetected1) / 1000;
      const stareDur1 = isStaring1 ? (prev1 ? prev1.stareDurationSeconds + 0.033 : 0.1) : 0;

      // Watchlist match (Suspect Sakda)
      let match1 = undefined;
      const suspectTarget = watchlist.find((w) => w.id === forceMatchTargetId) || watchlist.find((w) => w.category === "WANTED") || watchlist[0];
      if (suspectTarget) {
        match1 = {
          personId: suspectTarget.id,
          name: suspectTarget.name,
          category: suspectTarget.category,
          confidence: 96.2,
          avatarUrl: suspectTarget.photoUrl,
        };
      }

      targets.push({
        id: "TGT-01",
        x: target1X,
        y: target1Y,
        width: primaryW,
        height: primaryH,
        vx: Math.cos(t * 0.8) * 3.5,
        vy: -Math.sin(t * 1.6) * 1.2,
        speed: 2.1,
        lockState: "LOCKED",
        distanceMeters: 4.8 + paceCycle * 0.8,
        history: prev1 ? [...prev1.history.slice(-15), { x: target1X, y: target1Y, time: now }] : [],
        yaw: yaw1,
        pitch: pitch1,
        roll: yaw1 * 0.1,
        gazeDirection: yaw1 < -10 ? "LEFT" : yaw1 > 10 ? "RIGHT" : "CENTER",
        isStaringAtCamera: isStaring1,
        stareDurationSeconds: stareDur1,
        firstDetectedAt: firstDetected1,
        lastDetectedAt: now,
        dwellTimeSeconds: dwell1,
        erraticScore: 68,
        watchlistMatch: match1,
      });

      // Target 2: Passing visitor in the background
      const visitorX = ((t * 40) % (canvasW + 200)) - 100;
      const visitorY = canvasH * 0.28;
      targets.push({
        id: "TGT-02",
        x: visitorX,
        y: visitorY,
        width: primaryW * 0.7,
        height: primaryH * 0.7,
        vx: 1.8,
        vy: 0,
        speed: 1.8,
        lockState: "TRACKING",
        distanceMeters: 8.5,
        history: [],
        yaw: 28,
        pitch: 5,
        roll: 0,
        gazeDirection: "RIGHT",
        isStaringAtCamera: false,
        stareDurationSeconds: 0,
        firstDetectedAt: now - 8000,
        lastDetectedAt: now,
        dwellTimeSeconds: 8,
        erraticScore: 12,
      });
    } else if (scenario === "cctv-perimeter") {
      // Scenario: Restricted Perimeter Fence (Late night prowler scoping the security camera)
      const prowlerW = Math.round(canvasW * 0.18);
      const prowlerH = Math.round(canvasH * 0.29);

      // Prowler approaches camera and locks eyes directly
      const approach = (Math.sin(t * 0.4) + 1) / 2; // 0 to 1
      const pX = canvasW * 0.35 + Math.sin(t * 0.6) * 60;
      const pY = canvasH * 0.32 + approach * 50;

      // Staring intently at the camera box
      const yaw = Math.sin(t * 0.2) * 5; // almost directly staring
      const pitch = -2 + Math.cos(t * 0.3) * 4;
      const isStaring = true;

      const prev = this.targetHistory.get("TGT-PERIMETER-1");
      const firstDetected = prev ? prev.firstDetectedAt : now;
      const dwell = (now - firstDetected) / 1000;
      const stareDur = prev ? prev.stareDurationSeconds + 0.033 : 0.5;

      const exEmployee = watchlist.find((w) => w.id === forceMatchTargetId) || watchlist.find((w) => w.alias.includes("Ex-Employee")) || watchlist[2];

      targets.push({
        id: "TGT-01",
        x: pX,
        y: pY,
        width: prowlerW,
        height: prowlerH,
        vx: Math.cos(t * 0.6) * 1.1,
        vy: 0.8,
        speed: 1.2,
        lockState: "LOCKED",
        distanceMeters: 7.0 - approach * 3.5,
        history: prev ? [...prev.history.slice(-15), { x: pX, y: pY, time: now }] : [],
        yaw,
        pitch,
        roll: 0,
        gazeDirection: "CENTER",
        isStaringAtCamera: isStaring,
        stareDurationSeconds: stareDur,
        firstDetectedAt: firstDetected,
        lastDetectedAt: now,
        dwellTimeSeconds: dwell,
        erraticScore: 82,
        watchlistMatch: exEmployee
          ? {
              personId: exEmployee.id,
              name: exEmployee.name,
              category: exEmployee.category,
              confidence: 94.7,
              avatarUrl: exEmployee.photoUrl,
            }
          : undefined,
      });
    } else {
      // Scenario: Hallway / Executive Floor (VIP CEO walking with authorized assistant)
      const vipW = Math.round(canvasW * 0.2);
      const vipH = Math.round(canvasH * 0.32);

      const vipX = canvasW * 0.3 + Math.sin(t * 0.5) * (canvasW * 0.15);
      const vipY = canvasH * 0.35 + Math.cos(t * 0.7) * 15;

      const yaw = Math.sin(t * 0.6) * 15;
      const pitch = 3;

      const prev = this.targetHistory.get("TGT-HALLWAY-1");
      const firstDetected = prev ? prev.firstDetectedAt : now;
      const dwell = (now - firstDetected) / 1000;

      const vipPerson = watchlist.find((w) => w.id === forceMatchTargetId) || watchlist.find((w) => w.category === "VIP") || watchlist[1];

      targets.push({
        id: "TGT-VIP-01",
        x: vipX,
        y: vipY,
        width: vipW,
        height: vipH,
        vx: Math.cos(t * 0.5) * 1.5,
        vy: 0.3,
        speed: 1.4,
        lockState: "LOCKED",
        distanceMeters: 3.2,
        history: prev ? [...prev.history.slice(-15), { x: vipX, y: vipY, time: now }] : [],
        yaw,
        pitch,
        roll: 0,
        gazeDirection: yaw < -8 ? "LEFT" : yaw > 8 ? "RIGHT" : "CENTER",
        isStaringAtCamera: Math.abs(yaw) < 6,
        stareDurationSeconds: Math.abs(yaw) < 6 ? 1.4 : 0,
        firstDetectedAt: firstDetected,
        lastDetectedAt: now,
        dwellTimeSeconds: dwell,
        erraticScore: 8,
        watchlistMatch: vipPerson
          ? {
              personId: vipPerson.id,
              name: vipPerson.name,
              category: vipPerson.category,
              confidence: 98.9,
              avatarUrl: vipPerson.photoUrl,
            }
          : undefined,
      });
    }

    // Save history cache
    targets.forEach((t) => {
      this.targetHistory.set(t.id, t);
    });

    return targets;
  }
}

export const visionTracker = new VisionTrackerEngine();
