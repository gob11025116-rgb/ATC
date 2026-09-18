import React, { useRef, useEffect, useState } from "react";
import { TargetFace, PTZState, VideoSourceOption } from "../types";
import { drawTacticalHUD, DrawOptions } from "../utils/hudRenderer";
import { soundManager } from "../utils/audio";
import {
  Camera,
  Eye,
  Crosshair,
  Compass,
  Maximize2,
  Video,
  ShieldAlert,
  Volume2,
  VolumeX,
  Scan,
  Compass as CompassIcon,
} from "lucide-react";

interface TargetHUDCanvasProps {
  targets: TargetFace[];
  primaryTarget: TargetFace | null;
  ptz: PTZState;
  videoSource: VideoSourceOption["id"];
  onSourceChange: (sourceId: VideoSourceOption["id"]) => void;
  videoElement: HTMLVideoElement | null;
  onSnapshot: (dataUrl: string) => void;
  onRequestAIAnalysis: () => void;
  isAnalyzingAI: boolean;
}

export const TargetHUDCanvas: React.FC<TargetHUDCanvasProps> = ({
  targets,
  primaryTarget,
  ptz,
  videoSource,
  onSourceChange,
  videoElement,
  onSnapshot,
  onRequestAIAnalysis,
  isAnalyzingAI,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hudOptions, setHudOptions] = useState<DrawOptions>({
    showGazeRay: true,
    showLeadVector: true,
    showLandmarks: true,
    colorFilter: "normal",
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(30);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());
  const prevLockIdRef = useRef<string | null>(null);

  // Sound lock trigger
  useEffect(() => {
    if (primaryTarget && primaryTarget.lockState === "LOCKED") {
      if (prevLockIdRef.current !== primaryTarget.id) {
        soundManager.playTargetLocked();
        prevLockIdRef.current = primaryTarget.id;
      }
    } else {
      prevLockIdRef.current = null;
    }
  }, [primaryTarget]);

  // Render loop
  useEffect(() => {
    let animId: number;

    const render = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Handle resolution sync
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
      }

      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // 1. Draw Background Feed
      if (videoSource === "webcam" && videoElement && videoElement.readyState >= 2) {
        // Draw real webcam
        ctx.save();
        // Flip horizontally for natural mirror effect
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, 0, 0, w, h);
        ctx.restore();
      } else {
        // Render Simulated CCTV Atmosphere
        renderSimulatedCCTVBackground(ctx, w, h, videoSource, time);
      }

      // 2. Draw HUD Overlay
      drawTacticalHUD(ctx, w, h, targets, ptz, hudOptions, time);

      // FPS calculation
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [targets, ptz, hudOptions, videoSource, videoElement]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setSoundEnabled(next);
  };

  const captureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onSnapshot(dataUrl);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/60">
      {/* Top Tactical Status Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-slate-800/80 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-semibold tracking-wider">SYSTEM ARMED</span>
          </div>

          <div className="h-3 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-slate-300">
            <Scan className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              LOCK:{" "}
              <strong className={primaryTarget ? "text-cyan-400" : "text-slate-500"}>
                {primaryTarget ? primaryTarget.id : "SCANNING..."}
              </strong>
            </span>
          </div>

          <div className="h-3 w-px bg-slate-700 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
            <CompassIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>
              SERVO: {ptz.panAngle.toFixed(1)}° / {ptz.tiltAngle.toFixed(1)}°
            </span>
          </div>
        </div>

        {/* Video Source Pills */}
        <div className="flex items-center gap-1.5 mt-1.5 sm:mt-0">
          <button
            id="source-webcam-btn"
            onClick={() => onSourceChange("webcam")}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              videoSource === "webcam"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            กล้องสด (Webcam)
          </button>
          <button
            id="source-cctv-1-btn"
            onClick={() => onSourceChange("cctv-entrance")}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              videoSource === "cctv-entrance"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            จุดตรวจ 01
          </button>
          <button
            id="source-cctv-2-btn"
            onClick={() => onSourceChange("cctv-perimeter")}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              videoSource === "cctv-perimeter"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            แนวรั้ว 02
          </button>
          <button
            id="source-cctv-3-btn"
            onClick={() => onSourceChange("cctv-hallway")}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              videoSource === "cctv-hallway"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            โถง VIP
          </button>
        </div>
      </div>

      {/* Main HUD Canvas Screen */}
      <div ref={containerRef} className="relative w-full aspect-video min-h-[360px] bg-black overflow-hidden select-none">
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

        {/* Webcam Request / Reconnect Overlay */}
        {videoSource === "webcam" && (!videoElement || videoElement.readyState < 2) && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-3 z-10">
            <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/40">
              <Camera className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">ระบบเชื่อมต่อกล้องจริง (Live Camera System)</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                คลิกปุ่มด้านล่างเพื่อเปิดใช้งานกล้องเว็บแคมสำหรับตรวจจับใบหน้า คำนวณทิศทางการมอง และติดตามพิกัด
              </p>
            </div>
            <button
              onClick={() => onSourceChange("webcam")}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/30 flex items-center gap-2 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              เปิดกล้องเว็บแคมเดี๋ยวนี้ (Start Live Camera)
            </button>
          </div>
        )}

        {/* Live OSD Watermark */}
        <div className="absolute top-3 left-4 pointer-events-none flex flex-col gap-1 text-[11px] font-mono text-emerald-400 drop-shadow-md">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-red-600 text-white font-bold text-[10px] rounded tracking-widest animate-pulse">
              ● REC
            </span>
            <span className="text-slate-300 font-semibold tracking-wider">CH-01 [TARGET LOCK-ON]</span>
          </div>
          <span className="text-slate-400 text-[10px]">
            SENSOR: AI-OPTICAL-IR-09 | FPS: {fps} | RES: 1080P
          </span>
        </div>

        {/* Watchlist Alert Banner if Locked onto Suspect/VIP */}
        {primaryTarget?.watchlistMatch && (
          <div
            className={`absolute top-3 right-4 px-3 py-1.5 rounded-lg border backdrop-blur-md flex items-center gap-2.5 shadow-lg animate-bounce ${
              primaryTarget.watchlistMatch.category === "WANTED"
                ? "bg-red-950/80 border-red-500 text-red-200"
                : primaryTarget.watchlistMatch.category === "VIP"
                ? "bg-amber-950/80 border-amber-500 text-amber-200"
                : "bg-cyan-950/80 border-cyan-500 text-cyan-200"
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <div>
              <div className="text-[11px] font-bold tracking-wide">
                พบเป้าหมายเฝ้าระวัง: {primaryTarget.watchlistMatch.name}
              </div>
              <div className="text-[9px] opacity-80 font-mono">
                สถานะ: {primaryTarget.watchlistMatch.category} | ความคล้าย: {primaryTarget.watchlistMatch.confidence}%
              </div>
            </div>
          </div>
        )}

        {/* Quick HUD Overlay Controls */}
        <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-1.5 bg-slate-950/80 backdrop-blur border border-slate-800 px-2.5 py-1.5 rounded-lg text-[11px]">
          <button
            id="toggle-gaze-ray-btn"
            onClick={() => setHudOptions((prev) => ({ ...prev, showGazeRay: !prev.showGazeRay }))}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              hudOptions.showGazeRay ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="แสดงลำแสงทิศทางการมอง (Gaze Vector Ray)"
          >
            <Eye className="w-3.5 h-3.5" />
            ทิศทางการมอง
          </button>

          <button
            id="toggle-lead-vector-btn"
            onClick={() => setHudOptions((prev) => ({ ...prev, showLeadVector: !prev.showLeadVector }))}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              hudOptions.showLeadVector ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="แสดงเวกเตอร์การเคลื่อนไหว (Lead Movement Vector)"
          >
            <Crosshair className="w-3.5 h-3.5" />
            เวกเตอร์เคลื่อนที่
          </button>

          {/* Color Filter dropdown */}
          <select
            value={hudOptions.colorFilter}
            onChange={(e) => setHudOptions((prev) => ({ ...prev, colorFilter: e.target.value as any }))}
            className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded text-[11px] focus:outline-none focus:border-cyan-500"
          >
            <option value="normal">โหมดสีปกติ (Standard)</option>
            <option value="night_vision">ไนท์วิชั่น (Night Vision)</option>
            <option value="thermal">กล้องจับความร้อน (Thermal)</option>
            <option value="tactical_grid">ตารางพิกัด (Tactical Grid)</option>
          </select>
        </div>

        {/* Right Action buttons */}
        <div className="absolute bottom-3 right-4 flex items-center gap-2">
          <button
            id="toggle-sound-btn"
            onClick={toggleSound}
            className={`p-2 rounded-lg border backdrop-blur transition-all ${
              soundEnabled
                ? "bg-slate-900/80 border-slate-700 text-emerald-400 hover:bg-slate-800"
                : "bg-slate-900/80 border-slate-700 text-slate-500 hover:bg-slate-800"
            }`}
            title={soundEnabled ? "ปิดเสียงระบบ (Mute Sound)" : "เปิดเสียงระบบ (Enable Sound)"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            id="capture-snapshot-btn"
            onClick={captureSnapshot}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur transition-all active:scale-95"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            บันทึกภาพ
          </button>

          <button
            id="deep-ai-analyze-btn"
            onClick={onRequestAIAnalysis}
            disabled={isAnalyzingAI}
            className="px-3.5 py-1.5 rounded-lg border border-cyan-500/50 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Scan className="w-3.5 h-3.5" />
            {isAnalyzingAI ? "กำลังวิเคราะห์..." : "วิเคราะห์พฤติกรรม AI"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Procedural high-tech CCTV Background simulation
function renderSimulatedCCTVBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  source: string,
  time: number
) {
  // Gradients for floor and walls
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (source === "cctv-perimeter") {
    grad.addColorStop(0, "#030712");
    grad.addColorStop(0.55, "#0b1329");
    grad.addColorStop(1, "#020617");
  } else if (source === "cctv-hallway") {
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.5, "#1e293b");
    grad.addColorStop(1, "#0f172a");
  } else {
    grad.addColorStop(0, "#090d16");
    grad.addColorStop(0.6, "#131c2e");
    grad.addColorStop(1, "#090d16");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Perspective 3D Room Grid
  ctx.strokeStyle = "rgba(71, 85, 105, 0.2)";
  ctx.lineWidth = 1;

  const horizon = h * 0.58;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();

  // Vanishing lines to center
  const cx = w * 0.5;
  for (let i = -4; i <= 4; i++) {
    const bottomX = cx + (i * w) / 5;
    ctx.beginPath();
    ctx.moveTo(cx, horizon);
    ctx.lineTo(bottomX, h);
    ctx.stroke();
  }

  // Draw simulated architecture/pillars
  ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
  ctx.fillRect(w * 0.08, horizon - 90, 40, 180);
  ctx.fillRect(w * 0.88, horizon - 90, 40, 180);

  // Subtle surveillance camera noise texture
  ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
  for (let i = 0; i < 400; i++) {
    const nx = (Math.sin(time * 0.001 + i * 3) * 0.5 + 0.5) * w;
    const ny = (Math.cos(time * 0.002 + i * 7) * 0.5 + 0.5) * h;
    ctx.fillRect(nx, ny, 2, 2);
  }
}
