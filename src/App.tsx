import React, { useState, useEffect, useRef } from "react";
import {
  TargetFace,
  PTZState,
  WatchlistPerson,
  MobileNotification,
  VideoSourceOption,
  AIAnalysisResult,
} from "./types";
import { visionTracker } from "./utils/visionEngine";
import { soundManager } from "./utils/audio";
import { INITIAL_WATCHLIST } from "./data/mockWatchlist";
import { TargetHUDCanvas } from "./components/TargetHUDCanvas";
import { PTZTurretControl } from "./components/PTZTurretControl";
import { WatchlistManager } from "./components/WatchlistManager";
import { MobileAlertSimulator } from "./components/MobileAlertSimulator";
import { BehaviorAnalyticsPanel } from "./components/BehaviorAnalyticsPanel";
import { IncidentHistoryLog, IncidentRecord } from "./components/IncidentHistoryLog";
import {
  Shield,
  Crosshair,
  Compass,
  Users,
  Smartphone,
  Brain,
  History,
  AlertOctagon,
  Radar,
  Radio,
} from "lucide-react";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<
    "hud" | "analytics" | "watchlist" | "mobile" | "history"
  >("hud");

  // Core Vision & Tracking State
  const [videoSource, setVideoSource] = useState<VideoSourceOption["id"]>("webcam");
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [targets, setTargets] = useState<TargetFace[]>([]);
  const [primaryTarget, setPrimaryTarget] = useState<TargetFace | null>(null);

  // PTZ Motor State
  const [ptz, setPtz] = useState<PTZState>({
    panAngle: 0,
    tiltAngle: 0,
    targetPan: 0,
    targetTilt: 0,
    autoTrackEnabled: true,
    trackingSpeed: 5,
    damping: 0.8,
    motorStatus: "IDLE",
    pwmSignalX: 1500,
    pwmSignalY: 1500,
  });

  // Watchlist State (Synchronized with Backend Database)
  const [watchlist, setWatchlist] = useState<WatchlistPerson[]>([]);
  const [matchThreshold, setMatchThreshold] = useState<number>(85);
  const [activeForceMatchId, setActiveForceMatchId] = useState<string | null>(null);
  const [lastCapturedSnapshot, setLastCapturedSnapshot] = useState<string | null>(null);

  // Mobile Notifications
  const [mobileNotifications, setMobileNotifications] = useState<MobileNotification[]>([]);

  // Incident Records History (Synchronized with Backend Database)
  const [incidentRecords, setIncidentRecords] = useState<IncidentRecord[]>([]);

  // AI Behavior Analysis Result
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);

  // Debounce notification triggers
  const lastAlertTimeRef = useRef<number>(Date.now());

  // Load Watchlist and Incidents from Database on Startup
  useEffect(() => {
    // 1. Fetch Watchlist
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWatchlist(data);
        }
      })
      .catch((err) => console.error("Error fetching watchlist from database:", err));

    // 2. Fetch Incidents
    fetch("/api/incidents")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setIncidentRecords(data);
        }
      })
      .catch((err) => console.error("Error fetching incidents from database:", err));

    // 3. Auto-start live webcam
    visionTracker
      .initWebcam()
      .then((video) => {
        setVideoElement(video);
      })
      .catch((err) => {
        console.warn("Auto-webcam start deferred waiting for user click:", err);
      });
  }, []);

  // Switch video source
  const handleSourceChange = async (sourceId: VideoSourceOption["id"]) => {
    setVideoSource(sourceId);
    if (sourceId === "webcam") {
      try {
        const video = await visionTracker.initWebcam();
        setVideoElement(video);
      } catch (err) {
        console.error("Webcam access denied or unavailable:", err);
      }
    } else {
      visionTracker.stopWebcam();
      setVideoElement(null);
    }
  };

  // Add Target to Database
  const handleAddTargetToDatabase = async (newTarget: WatchlistPerson) => {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTarget),
      });
      const saved = await res.json();
      setWatchlist((prev) => [saved, ...prev]);
    } catch (err) {
      console.error("Failed to add target to database:", err);
      setWatchlist((prev) => [newTarget, ...prev]);
    }
  };

  // Delete Target from Database
  const handleDeleteTargetFromDatabase = async (id: string) => {
    try {
      await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      setWatchlist((prev) => prev.filter((p) => p.id !== id));
      if (activeForceMatchId === id) setActiveForceMatchId(null);
    } catch (err) {
      console.error("Failed to delete target from database:", err);
      setWatchlist((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Main Tracking Loop
  useEffect(() => {
    const interval = setInterval(() => {
      const { targets: newTargets, primaryTarget: newPrimary, updatedPTZ } = visionTracker.updateTargets(
        videoSource,
        800,
        450,
        ptz,
        watchlist,
        matchThreshold,
        activeForceMatchId
      );

      setTargets(newTargets);
      setPrimaryTarget(newPrimary);
      setPtz(updatedPTZ);

      // Check for automatic mobile push trigger
      if (newPrimary && newPrimary.watchlistMatch) {
        const now = Date.now();
        if (now - lastAlertTimeRef.current > 15000) {
          // Send push alert
          const isWanted = newPrimary.watchlistMatch.category === "WANTED";
          const newNotif: MobileNotification = {
            id: `PUSH-${now.toString().slice(-4)}`,
            timestamp: new Date().toLocaleTimeString("th-TH"),
            title: isWanted ? "🚨 แจ้งเตือนด่วน: พบเป้าหมายมีหมายจับ!" : `ตรวจพบ ${newPrimary.watchlistMatch.name}`,
            message: `ตรวจพบบุคคลเฝ้าระวังพิเศษในระยะ ${newPrimary.distanceMeters.toFixed(1)} ม. ทิศทางสายตา: ${newPrimary.gazeDirection}`,
            targetName: newPrimary.watchlistMatch.name,
            category: newPrimary.watchlistMatch.category,
            threatLevel: isWanted ? "CRITICAL" : "NORMAL",
            confidence: newPrimary.watchlistMatch.confidence,
            gazeInfo: newPrimary.isStaringAtCamera ? `จ้องกล้อง ${newPrimary.stareDurationSeconds.toFixed(1)}s` : "มองทิศทางทั่วไป",
            snapshotUrl: newPrimary.watchlistMatch.avatarUrl,
            acknowledged: false,
            location: videoSource === "cctv-entrance" ? "จุดตรวจ 01" : videoSource === "cctv-perimeter" ? "แนวรั้ว 02" : "กล้องวงจรปิดหลัก",
          };

          setMobileNotifications((prev) => [newNotif, ...prev.slice(0, 19)]);
          soundManager.playMobileNotification();
          lastAlertTimeRef.current = now;

          // Add to log
          const newLog: IncidentRecord = {
            id: `LOG-${now.toString().slice(-4)}`,
            timestamp: new Date().toLocaleTimeString("th-TH"),
            targetId: newPrimary.id,
            targetName: newPrimary.watchlistMatch.name,
            category: newPrimary.watchlistMatch.category,
            gazeDirection: newPrimary.isStaringAtCamera ? "จ้องกล้องตรงๆ" : `มอง${newPrimary.gazeDirection}`,
            stareDurationSeconds: newPrimary.stareDurationSeconds,
            dwellTimeSeconds: newPrimary.dwellTimeSeconds,
            threatLevel: isWanted ? "CRITICAL" : "NORMAL",
            threatScore: isWanted ? 95 : 15,
            notes: `ระบบล็อคเป้าเทียบเคียงใบหน้าตรงกับบัญชีเฝ้าระวัง ${newPrimary.watchlistMatch.name}`,
          };
          setIncidentRecords((prev) => [newLog, ...prev.slice(0, 49)]);

          // Persist to backend database
          fetch("/api/incidents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newLog),
          }).catch(console.error);
        }
      }
    }, 40);

    return () => clearInterval(interval);
  }, [videoSource, ptz, watchlist, matchThreshold, activeForceMatchId]);

  // Handle Snapshot
  const handleSnapshot = (dataUrl: string) => {
    setLastCapturedSnapshot(dataUrl);
    soundManager.playTargetLocked();
  };

  // Request Deep Gemini AI Behavioral Analysis
  const handleRequestAIAnalysis = async () => {
    if (!primaryTarget) return;
    setIsAnalyzingAI(true);
    try {
      // Capture live image from webcam if available
      let snapshotToSend = lastCapturedSnapshot;
      if (videoElement && videoElement.readyState >= 2) {
        try {
          const snapCanvas = document.createElement("canvas");
          snapCanvas.width = videoElement.videoWidth || 640;
          snapCanvas.height = videoElement.videoHeight || 480;
          const snapCtx = snapCanvas.getContext("2d");
          if (snapCtx) {
            snapCtx.drawImage(videoElement, 0, 0, snapCanvas.width, snapCanvas.height);
            snapshotToSend = snapCanvas.toDataURL("image/jpeg", 0.85);
            setLastCapturedSnapshot(snapshotToSend);
          }
        } catch (e) {
          console.warn("Snapshot capture error:", e);
        }
      }

      const response = await fetch("/api/analyze-behavior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetData: {
            targetId: primaryTarget.id,
            dwellTimeSeconds: Math.round(primaryTarget.dwellTimeSeconds),
            gazeDirection: primaryTarget.gazeDirection,
            yaw: Math.round(primaryTarget.yaw),
            pitch: Math.round(primaryTarget.pitch),
            gazeFixationSeconds: Number(primaryTarget.stareDurationSeconds.toFixed(1)),
            speed: primaryTarget.speed.toFixed(1),
            erraticScore: primaryTarget.erraticScore,
            watchlistMatch: primaryTarget.watchlistMatch,
          },
          snapshotBase64: snapshotToSend,
        }),
      });

      const data = await response.json();
      setAiResult({
        threatScore: data.threatScore || 30,
        level: data.level || "NORMAL",
        summary: data.summary || "ประมวลผลการวิเคราะห์พฤติกรรมเรียบร้อย",
        behaviorDetails: data.behaviorDetails || [],
        intentInference: data.intentInference || "พฤติกรรมการสัญจรทั่วไป",
        recommendedAction: data.recommendedAction || "ติดตามตามวงรอบปกติ",
        modelUsed: data.modelUsed || "Google Gemini 3.8 Flash",
        analyzedAt: new Date().toLocaleTimeString("th-TH"),
      });

      soundManager.playTargetLocked();
      setActiveTab("analytics");
    } catch (err) {
      console.error("AI Analysis failed:", err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="bg-slate-950/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Crosshair className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  ระบบกล่องล็อคเป้า AI อัจฉริยะ
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold">
                  AI TARGET LOCK & TRACKING
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                ตรวจจับใบหน้า • ติดตามการเคลื่อนไหว • ตรวจจับทิศทางการมอง • ระบบหันตาม • บัญชีเฝ้าระวังพิเศษ • แจ้งเตือนมือถือทันที
              </p>
            </div>
          </div>

          {/* Quick Status Stats */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300">
                เป้าหมายในระยะ: <strong className="text-cyan-400">{targets.length}</strong>
              </span>
            </div>

            <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 hidden md:flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-slate-300">
                เฝ้าระวังพิเศษ: <strong className="text-red-400">{watchlist.length} คน</strong>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2 text-xs font-medium no-scrollbar">
          <button
            id="nav-tab-hud"
            onClick={() => setActiveTab("hud")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === "hud"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Crosshair className="w-4 h-4" />
            หน้าจอกล้อง & ควบคุมเซอร์โว (HUD & PTZ)
          </button>

          <button
            id="nav-tab-analytics"
            onClick={() => setActiveTab("analytics")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === "analytics"
                ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Brain className="w-4 h-4" />
            วิเคราะห์พฤติกรรม & ทิศทางการมอง
          </button>

          <button
            id="nav-tab-watchlist"
            onClick={() => setActiveTab("watchlist")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === "watchlist"
                ? "bg-red-600 text-white font-bold shadow-md shadow-red-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Users className="w-4 h-4" />
            บุคคลเฝ้าระวังพิเศษ ({watchlist.length})
          </button>

          <button
            id="nav-tab-mobile"
            onClick={() => setActiveTab("mobile")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === "mobile"
                ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            แจ้งเตือนแอปมือถือ ({mobileNotifications.length})
          </button>

          <button
            id="nav-tab-history"
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === "history"
                ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <History className="w-4 h-4" />
            ประวัติเหตุการณ์ ({incidentRecords.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-5">
        {/* TAB 1: Main HUD & PTZ Turret Controls */}
        {activeTab === "hud" && (
          <div className="flex flex-col gap-4">
            <TargetHUDCanvas
              targets={targets}
              primaryTarget={primaryTarget}
              ptz={ptz}
              videoSource={videoSource}
              onSourceChange={handleSourceChange}
              videoElement={videoElement}
              onSnapshot={handleSnapshot}
              onRequestAIAnalysis={handleRequestAIAnalysis}
              isAnalyzingAI={isAnalyzingAI}
            />

            <PTZTurretControl
              ptz={ptz}
              primaryTarget={primaryTarget}
              onUpdatePTZ={(updates) => setPtz((prev) => ({ ...prev, ...updates }))}
            />
          </div>
        )}

        {/* TAB 2: Behavior & Gaze Analytics */}
        {activeTab === "analytics" && (
          <div className="flex flex-col gap-4">
            <BehaviorAnalyticsPanel
              primaryTarget={primaryTarget}
              aiResult={aiResult}
              isAnalyzingAI={isAnalyzingAI}
              onRequestAIAnalysis={handleRequestAIAnalysis}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 flex flex-col gap-2">
                <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Radar className="w-4 h-4 text-cyan-400" />
                  เกณฑ์การตรวจจับทิศทางการมอง (Gaze Detection Matrix)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  ระบบทำการคำนวณเวกเตอร์ 3 มิติจากมุมเอียงศีรษะ (Head Pose Yaw/Pitch/Roll) ร่วมกับตำแหน่งรูม่านตา:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono text-[11px]">
                  <li>จ้องกล้องตรงๆ (Direct Eye Contact): Yaw ±8° และ Pitch ±6° เป็นระยะเวลาเกิน 3 วินาที</li>
                  <li>มองซ้าย/ขวา (Looking Away): ตรวจจับมุมส่ายศีรษะเกิน 15° เพื่อระบุความระแวดระวัง</li>
                  <li>หลบสายตา (Averted Gaze): ทิศทางการมองเบี่ยงลงทันทีเมื่อระบบสาดไฟหรือกล้องหันตาม</li>
                </ul>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 flex flex-col gap-2">
                <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  ระบบวิเคราะห์เวลาป้วนเปี้ยน (Loitering & Dwell Time Engine)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  ตรวจวัดระยะเวลาที่เป้าหมายคงอยู่ในรัศมีระยะสายตาของกล้อง:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono text-[11px]">
                  <li>0 - 15 วินาที: การสัญจรปกติ (Normal Transit)</li>
                  <li>15 - 30 วินาที: เริ่มจับตาดูความเคลื่อนไหว (Observation Phase)</li>
                  <li>&gt; 30 วินาที: พฤติกรรมป้วนเปี้ยนผิดปกติ (Suspicious Loitering) แจ้งเตือนแอปมือถืออัตโนมัติ</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Special Watchlist Management */}
        {activeTab === "watchlist" && (
          <WatchlistManager
            watchlist={watchlist}
            matchThreshold={matchThreshold}
            onThresholdChange={setMatchThreshold}
            onAddTarget={handleAddTargetToDatabase}
            onDeleteTarget={handleDeleteTargetFromDatabase}
            onForceMatch={(id) => setActiveForceMatchId(activeForceMatchId === id ? null : id)}
            activeMatchId={activeForceMatchId}
            lastCapturedSnapshot={lastCapturedSnapshot}
            videoElement={videoElement}
          />
        )}

        {/* TAB 4: Instant Mobile Push Notification Simulator */}
        {activeTab === "mobile" && (
          <MobileAlertSimulator
            notifications={mobileNotifications}
            onDismiss={(id) => setMobileNotifications((prev) => prev.filter((n) => n.id !== id))}
            onClearAll={() => setMobileNotifications([])}
            onTriggerTestPush={() => {
              const testNotif: MobileNotification = {
                id: `PUSH-${Date.now().toString().slice(-4)}`,
                timestamp: new Date().toLocaleTimeString("th-TH"),
                title: "🚨 ทดสอบการส่งการแจ้งเตือนฉุกเฉิน",
                message: "ระบบจำลองการแจ้งเตือนเข้าแอปพลิเคชันมือถือของเจ้าหน้าที่ความปลอดภัย",
                targetName: primaryTarget?.watchlistMatch?.name || "เป้าหมาย TGT-01",
                category: primaryTarget?.watchlistMatch?.category || "SUSPECT",
                threatLevel: "CRITICAL",
                confidence: 94.5,
                gazeInfo: "จ้องมองกล้องโดยตรง",
                snapshotUrl: primaryTarget?.watchlistMatch?.avatarUrl || lastCapturedSnapshot || undefined,
                acknowledged: false,
                location: "กล้องจุดตรวจหลัก 01",
              };
              setMobileNotifications((prev) => [testNotif, ...prev]);
              soundManager.playMobileNotification();
            }}
          />
        )}

        {/* TAB 5: Incident History Logs */}
        {activeTab === "history" && (
          <IncidentHistoryLog
            records={incidentRecords}
            onClearLogs={() => setIncidentRecords([])}
          />
        )}
      </main>
    </div>
  );
}
