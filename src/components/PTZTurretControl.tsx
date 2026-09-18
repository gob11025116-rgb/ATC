import React, { useState, useRef, useEffect } from "react";
import { PTZState, TargetFace } from "../types";
import { soundManager } from "../utils/audio";
import {
  Compass,
  RotateCw,
  Move,
  Activity,
  Zap,
  Gauge,
  Sliders,
  Maximize,
} from "lucide-react";

interface PTZTurretControlProps {
  ptz: PTZState;
  primaryTarget: TargetFace | null;
  onUpdatePTZ: (newPTZ: Partial<PTZState>) => void;
}

export const PTZTurretControl: React.FC<PTZTurretControlProps> = ({
  ptz,
  primaryTarget,
  onUpdatePTZ,
}) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle virtual joystick manual steering
  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width / 2)));
    const deltaY = Math.max(-1, Math.min(1, (clientY - centerY) / (rect.height / 2)));

    const newPan = deltaX * 85;
    const newTilt = -deltaY * 40; // up is positive tilt

    onUpdatePTZ({
      panAngle: newPan,
      tiltAngle: newTilt,
      autoTrackEnabled: false, // temporarily pause auto-track on manual input
      motorStatus: "SLEWING",
    });

    soundManager.playServoMovement();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    handleJoystickMove(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        handleJoystickMove(e.clientX, e.clientY);
      }
    };
    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  const resetToCenter = () => {
    onUpdatePTZ({
      panAngle: 0,
      tiltAngle: 0,
      motorStatus: "IDLE",
    });
    soundManager.playServoMovement();
  };

  // Joystick knob position
  const knobX = (ptz.panAngle / 85) * 42; // -42 to +42 px
  const knobY = -(ptz.tiltAngle / 40) * 42;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              ระบบกล้องหันตามอัตโนมัติ (PTZ Tracking Turret)
            </h3>
            <p className="text-[11px] text-slate-400">ควบคุมและสั่งการมอเตอร์เซอร์โว 2-Axis Gimbal</p>
          </div>
        </div>

        {/* Auto Track Toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs font-medium text-slate-300">หันตามเป้าหมาย (Auto-Track)</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              id="auto-track-toggle"
              checked={ptz.autoTrackEnabled}
              onChange={(e) => {
                onUpdatePTZ({ autoTrackEnabled: e.target.checked });
                if (e.target.checked) soundManager.playServoMovement();
              }}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </div>
        </label>
      </div>

      {/* Main Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* 1. Virtual Joystick Steering */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            จอยสติ๊กจำลอง (Manual Joystick)
          </span>

          <div
            ref={joystickRef}
            onPointerDown={handlePointerDown}
            className="relative w-32 h-32 rounded-full bg-slate-950 border-2 border-slate-700/80 shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          >
            {/* Cross axis lines */}
            <div className="absolute w-full h-px bg-slate-800 pointer-events-none" />
            <div className="absolute h-full w-px bg-slate-800 pointer-events-none" />
            <div className="absolute w-20 h-20 rounded-full border border-slate-800/80 pointer-events-none" />

            {/* Draggable Knob */}
            <div
              style={{
                transform: `translate(${knobX}px, ${knobY}px)`,
              }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 border-2 border-cyan-200 shadow-md shadow-cyan-500/40 flex items-center justify-center text-[10px] font-bold text-slate-950 pointer-events-none transition-transform duration-75"
            >
              PTZ
            </div>
          </div>

          <button
            id="ptz-reset-center-btn"
            onClick={resetToCenter}
            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition-all active:scale-95"
          >
            <RotateCw className="w-3 h-3" />
            คืนสู่กึ่งกลาง (0°, 0°)
          </button>
        </div>

        {/* 2. Angle Dials & Real-time Gauges */}
        <div className="flex flex-col gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">องศาแกน Pan (แนวนอน):</span>
            <span className="text-emerald-400 font-bold text-sm">
              {ptz.panAngle > 0 ? "+" : ""}
              {ptz.panAngle.toFixed(1)}°
            </span>
          </div>
          {/* Pan bar indicator */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600" />
            <div
              className={`h-full transition-all duration-75 ${
                ptz.panAngle >= 0 ? "bg-emerald-500" : "bg-cyan-500"
              }`}
              style={{
                width: `${Math.abs(ptz.panAngle / 90) * 50}%`,
                marginLeft: ptz.panAngle >= 0 ? "50%" : `${50 - (Math.abs(ptz.panAngle) / 90) * 50}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">องศาแกน Tilt (แนวตั้ง):</span>
            <span className="text-cyan-400 font-bold text-sm">
              {ptz.tiltAngle > 0 ? "+" : ""}
              {ptz.tiltAngle.toFixed(1)}°
            </span>
          </div>
          {/* Tilt bar indicator */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600" />
            <div
              className={`h-full transition-all duration-75 ${
                ptz.tiltAngle >= 0 ? "bg-cyan-500" : "bg-amber-500"
              }`}
              style={{
                width: `${Math.abs(ptz.tiltAngle / 45) * 50}%`,
                marginLeft: ptz.tiltAngle >= 0 ? "50%" : `${50 - (Math.abs(ptz.tiltAngle) / 45) * 50}%`,
              }}
            />
          </div>

          {/* Motor Status Tag */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
            <span className="text-slate-400">สถานะมอเตอร์:</span>
            <span
              className={`px-2 py-0.5 rounded font-semibold ${
                ptz.motorStatus === "SLEWING"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : ptz.motorStatus === "LOCKED"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {ptz.motorStatus === "SLEWING"
                ? "⚡ กำลังหมุนตาม (SLEWING)"
                : ptz.motorStatus === "LOCKED"
                ? "🎯 ล็อคเป้าแล้ว (LOCKED)"
                : "สแตนด์บาย (IDLE)"}
            </span>
          </div>
        </div>

        {/* 3. Servo Signal Telemetry & Tuning */}
        <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>สัญญาณควบคุมเซอร์โว (PWM Signals)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <div className="text-slate-400">CH1 (Pan PWM):</div>
              <div className="text-emerald-400 font-bold text-sm">{ptz.pwmSignalX} µs</div>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <div className="text-slate-400">CH2 (Tilt PWM):</div>
              <div className="text-cyan-400 font-bold text-sm">{ptz.pwmSignalY} µs</div>
            </div>
          </div>

          {/* Sensitivity Sliders */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>ความเร็วหมุนตาม (Tracking Speed):</span>
              <span className="text-slate-200 font-mono">{ptz.trackingSpeed}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={ptz.trackingSpeed}
              onChange={(e) => onUpdatePTZ({ trackingSpeed: Number(e.target.value) })}
              className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
