import React from "react";
import { TargetFace, AIAnalysisResult } from "../types";
import {
  Brain,
  Eye,
  Clock,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Zap,
  TrendingUp,
  HelpCircle,
} from "lucide-react";

interface BehaviorAnalyticsPanelProps {
  primaryTarget: TargetFace | null;
  aiResult: AIAnalysisResult | null;
  isAnalyzingAI: boolean;
  onRequestAIAnalysis: () => void;
}

export const BehaviorAnalyticsPanel: React.FC<BehaviorAnalyticsPanelProps> = ({
  primaryTarget,
  aiResult,
  isAnalyzingAI,
  onRequestAIAnalysis,
}) => {
  // Current target metrics
  const dwellTime = primaryTarget ? primaryTarget.dwellTimeSeconds : 0;
  const stareTime = primaryTarget ? primaryTarget.stareDurationSeconds : 0;
  const erratic = primaryTarget ? primaryTarget.erraticScore : 10;
  const yaw = primaryTarget ? primaryTarget.yaw : 0;
  const pitch = primaryTarget ? primaryTarget.pitch : 0;
  const isStaring = primaryTarget ? primaryTarget.isStaringAtCamera : false;

  // Real-time calculated threat indicator
  let calculatedThreat = 15;
  if (primaryTarget?.watchlistMatch) calculatedThreat += 50;
  if (stareTime > 3) calculatedThreat += 25;
  if (dwellTime > 20) calculatedThreat += 15;
  if (erratic > 50) calculatedThreat += 15;
  calculatedThreat = Math.min(100, calculatedThreat);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              การวิเคราะห์พฤติกรรม & ทิศทางการมอง (Behavioral & Gaze Analytics)
            </h3>
            <p className="text-[11px] text-slate-400">
              ตรวจจับเวลาป้วนเปี้ยน (Dwell Time) การจ้องมองกล้อง และประเมินความเสี่ยงด้วย AI
            </p>
          </div>
        </div>

        <button
          onClick={onRequestAIAnalysis}
          disabled={isAnalyzingAI || !primaryTarget}
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all active:scale-95 disabled:opacity-50"
        >
          <Zap className="w-3.5 h-3.5" />
          {isAnalyzingAI ? "AI กำลังประมวลผล..." : "วิเคราะห์พฤติกรรมเชิงลึก (Gemini AI)"}
        </button>
      </div>

      {/* Real-time Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Gaze Direction & Stare Timer */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              การจ้องมองกล้อง (Stare)
            </span>
            {isStaring && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded font-bold animate-pulse">
                จ้องตรง!
              </span>
            )}
          </div>
          <div className="text-xl font-bold font-mono text-cyan-300">
            {stareTime.toFixed(1)} <span className="text-xs font-normal text-slate-400">วินาที</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Yaw: {yaw.toFixed(0)}° | Pitch: {pitch.toFixed(0)}°
          </div>
        </div>

        {/* 2. Dwell Time / Loitering */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              เวลาในพื้นที่ (Dwell Time)
            </span>
            {dwellTime > 30 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                ป้วนเปี้ยน
              </span>
            )}
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {dwellTime.toFixed(0)} <span className="text-xs font-normal text-slate-400">วินาที</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {dwellTime > 30 ? "อยู่ในรัศมีนานผิดปกติ" : "ระยะเวลาปกติ"}
          </div>
        </div>

        {/* 3. Movement Agitation / Erratic Score */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              ความแปรปรวน (Erratic)
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {erratic} <span className="text-xs font-normal text-slate-400">%</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {erratic > 60 ? "ส่ายไปมา/พฤติกรรมระแวดระวัง" : "การเคลื่อนไหวราบเรียบ"}
          </div>
        </div>

        {/* 4. Threat Level Meter */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              ดัชนีภัยคุกคาม (Threat)
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-red-400">
            {calculatedThreat} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {calculatedThreat >= 70 ? "🔴 ระดับวิกฤต (Critical)" : calculatedThreat >= 40 ? "🟡 เฝ้าระวัง (Suspicious)" : "🟢 ปกติ (Normal)"}
          </div>
        </div>
      </div>

      {/* Gemini AI Deep Behavior Analysis Output Card */}
      {aiResult ? (
        <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/40 flex flex-col gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-purple-500/20 text-purple-300">
                <Brain className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-purple-300">
                รายงานการวินิจฉัยพฤติกรรมโดย AI (Tactical AI Diagnosis)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{aiResult.modelUsed}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 text-xs text-purple-200">
            <strong>บทสรุปประเมิน: </strong> {aiResult.summary}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                การคาดการณ์เจตนาเป้าหมาย (Intent Inference)
              </div>
              <p className="text-slate-400 leading-relaxed">{aiResult.intentInference}</p>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                คำแนะนำการปฏิบัติการ (Recommended Action)
              </div>
              <p className="text-emerald-300/90 leading-relaxed">{aiResult.recommendedAction}</p>
            </div>
          </div>

          {aiResult.behaviorDetails && aiResult.behaviorDetails.length > 0 && (
            <div className="text-[11px] text-slate-400 flex flex-col gap-1 border-t border-slate-800 pt-2 font-mono">
              {aiResult.behaviorDetails.map((detail, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-cyan-400">•</span>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
          <Brain className="w-6 h-6 text-slate-600" />
          <span>กดปุ่ม "วิเคราะห์พฤติกรรมเชิงลึก (Gemini AI)" เพื่อส่งข้อมูลพิกัดสายตาและภาพประเมินเจตนาแบบละเอียด</span>
        </div>
      )}
    </div>
  );
};
