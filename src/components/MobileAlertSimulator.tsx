import React, { useState } from "react";
import { MobileNotification } from "../types";
import { soundManager } from "../utils/audio";
import {
  Smartphone,
  Bell,
  Volume2,
  CheckCircle,
  Siren,
  ShieldAlert,
  Send,
  ExternalLink,
  ChevronRight,
  Clock,
  MapPin,
  Eye,
} from "lucide-react";

interface MobileAlertSimulatorProps {
  notifications: MobileNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onTriggerTestPush: () => void;
}

export const MobileAlertSimulator: React.FC<MobileAlertSimulatorProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  onTriggerTestPush,
}) => {
  const [activeTab, setActiveTab] = useState<"phone" | "webhook">("phone");
  const [isVibrating, setIsVibrating] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Trigger siren
  const handleSoundSiren = () => {
    soundManager.playCriticalAlarm();
    setActionFeedback("เปิดสัญญาณไซเรนฉุกเฉินระดับ 1 ประจำจุดเรียบร้อยแล้ว!");
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleDispatchSecurity = () => {
    soundManager.playMobileNotification();
    setActionFeedback("ส่งคำสั่งชุดเคลื่อนที่เร็ว (Quick Response Force) ไปยังจุดเกิดเหตุแล้ว");
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const latestNotification = notifications[0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              การแจ้งเตือนผ่านมือถือทันที (Instant Mobile Push Simulator)
            </h3>
            <p className="text-[11px] text-slate-400">
              จำลองการส่ง Push Notification เข้าสมาร์ทโฟนของเจ้าหน้าที่ รปภ. / ผู้ดูแลระบบแบบเรียลไทม์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTriggerTestPush}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-xs border border-slate-700 flex items-center gap-1 transition-all active:scale-95"
          >
            <Bell className="w-3 h-3" />
            ทดสอบยิง Push
          </button>

          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
            >
              ล้างทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab("phone")}
          className={`px-3 py-1.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "phone"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          จำลองหน้าจอมือถือ (Device Screen)
        </button>
        <button
          onClick={() => setActiveTab("webhook")}
          className={`px-3 py-1.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "webhook"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Webhook & Telegram / LINE Integration
        </button>
      </div>

      {actionFeedback && (
        <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {activeTab === "phone" ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Smartphone Frame Simulation */}
          <div className="md:col-span-6 flex justify-center">
            <div className="w-full max-w-[320px] bg-slate-950 border-4 border-slate-700 rounded-[2.5rem] p-3 shadow-2xl relative overflow-hidden ring-1 ring-slate-800">
              {/* Phone Speaker & Camera Notch */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-900 ml-6" />
              </div>

              {/* Phone Lock Screen Header */}
              <div className="flex justify-between items-center px-3 text-[11px] font-medium text-slate-400 mb-4">
                <span>09:41</span>
                <div className="flex items-center gap-1">
                  <span>5G</span>
                  <div className="w-4 h-2 border border-slate-400 rounded-sm p-0.5 flex items-center">
                    <div className="w-full h-full bg-slate-400" />
                  </div>
                </div>
              </div>

              {/* Big Clock */}
              <div className="text-center mb-4">
                <div className="text-3xl font-light text-slate-100 font-mono">19:25</div>
                <div className="text-[11px] text-slate-400">วันพฤหัสบดีที่ 17 กันยายน</div>
              </div>

              {/* Push Notification Banner */}
              {latestNotification ? (
                <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-xl mb-3 animate-in slide-in-from-top-4 duration-300">
                  {/* Notification App Header */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-cyan-500 flex items-center justify-center text-[8px] font-bold text-black">
                        AI
                      </div>
                      <span className="font-semibold text-slate-300">SENTINEL LOCK-ON</span>
                    </div>
                    <span className="text-slate-500 font-mono">{latestNotification.timestamp}</span>
                  </div>

                  {/* Body with Snapshot */}
                  <div className="flex items-start gap-2.5 my-1.5">
                    {latestNotification.snapshotUrl && (
                      <img
                        src={latestNotification.snapshotUrl}
                        alt="Snapshot"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-1">
                        <span className="text-red-400">🚨</span>
                        <span className="truncate">{latestNotification.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                        {latestNotification.message}
                      </p>
                    </div>
                  </div>

                  {/* Detail tags */}
                  <div className="flex flex-wrap gap-1 mt-2 text-[9px] font-mono">
                    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5 text-cyan-400" />
                      {latestNotification.location}
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 flex items-center gap-0.5">
                      <Eye className="w-2.5 h-2.5 text-amber-400" />
                      {latestNotification.gazeInfo}
                    </span>
                    <span className="px-1.5 py-0.5 bg-red-950 text-red-300 border border-red-800/60 rounded">
                      ตรงกับเป้าหมาย {latestNotification.confidence}%
                    </span>
                  </div>

                  {/* Immediate Quick Actions */}
                  <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2 border-t border-slate-800">
                    <button
                      onClick={handleSoundSiren}
                      className="py-1 px-2 bg-red-600/90 hover:bg-red-500 text-white rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                    >
                      <Siren className="w-3 h-3" />
                      เปิดไซเรน
                    </button>
                    <button
                      onClick={handleDispatchSecurity}
                      className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
                    >
                      <ShieldAlert className="w-3 h-3 text-cyan-400" />
                      ส่งชุด รปภ.
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500 my-4">
                  ไม่มีการแจ้งเตือนใหม่ในขณะนี้
                  <br />
                  <span className="text-[10px]">ระบบพร้อมรับการแจ้งเตือนแบบเรียลไทม์ 24/7</span>
                </div>
              )}

              {/* Bottom Home Indicator */}
              <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-6" />
            </div>
          </div>

          {/* Notification History List */}
          <div className="md:col-span-6 flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>ประวัติการแจ้งเตือนส่งเข้ามือถือ ({notifications.length})</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="bg-slate-950/70 border border-slate-800/90 rounded-lg p-2.5 flex items-start justify-between gap-3 text-xs hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div
                      className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                        notif.threatLevel === "CRITICAL"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-cyan-500/20 text-cyan-400"
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 truncate">{notif.title}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                        <span>{notif.timestamp}</span>
                        <span>•</span>
                        <span>{notif.location}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDismiss(notif.id)}
                    className="text-slate-500 hover:text-slate-300 text-[10px] shrink-0 px-1"
                  >
                    ปิด
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Webhook & Telegram / LINE Notify tab */
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs flex flex-col gap-3 font-mono">
          <div className="text-slate-300 font-sans font-bold flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            การเชื่อมต่อ Webhook ส่งตรงเข้า LINE Official / Telegram Bot
          </div>
          <p className="text-slate-400 font-sans text-xs">
            เมื่อระบบกล้องล็อคเป้าตรวจพบเป้าหมายเฝ้าระวังพิเศษ ระบบจะยิง Webhook POST อัตโนมัติพร้อมแนบภาพ Snapshot
            และพิกัดทิศทางการมองไปยังมือถือของเจ้าหน้าที่
          </p>

          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto text-[11px]">
            <pre>
{`POST /api/webhook/alert HTTP/1.1
Content-Type: application/json
Authorization: Bearer sentinel_live_token_77

{
  "event": "TARGET_LOCKED_WATCHLIST",
  "targetId": "${latestNotification?.targetName || "TGT-01"}",
  "matchConfidence": ${latestNotification?.confidence || 96.4},
  "threatLevel": "CRITICAL",
  "gazeStatus": "${latestNotification?.gazeInfo || "DIRECT_STARE"}",
  "location": "MAIN_SECURITY_GATE_01",
  "servoAngles": { "pan": 14.2, "tilt": -3.8 },
  "actionRequired": "DISPATCH_SECURITY"
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
