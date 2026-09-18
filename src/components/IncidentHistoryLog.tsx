import React, { useState } from "react";
import { ThreatLevel } from "../types";
import { History, Download, Trash2, Filter, ShieldAlert, Eye, Clock } from "lucide-react";

export interface IncidentRecord {
  id: string;
  timestamp: string;
  targetId: string;
  targetName: string;
  category: string;
  gazeDirection: string;
  stareDurationSeconds: number;
  dwellTimeSeconds: number;
  threatLevel: ThreatLevel;
  threatScore: number;
  notes: string;
}

interface IncidentHistoryLogProps {
  records: IncidentRecord[];
  onClearLogs: () => void;
}

export const IncidentHistoryLog: React.FC<IncidentHistoryLogProps> = ({
  records,
  onClearLogs,
}) => {
  const [filterLevel, setFilterLevel] = useState<string>("ALL");

  const filtered = records.filter((rec) => {
    if (filterLevel === "ALL") return true;
    if (filterLevel === "WATCHLIST") return rec.category !== "UNKNOWN";
    return rec.threatLevel === filterLevel;
  });

  const exportToCSV = () => {
    if (records.length === 0) return;
    const headers = [
      "Timestamp",
      "Target ID",
      "Name",
      "Category",
      "Gaze Direction",
      "Stare Duration (s)",
      "Dwell Time (s)",
      "Threat Level",
      "Threat Score",
      "Notes",
    ];

    const rows = records.map((r) => [
      `"${r.timestamp}"`,
      `"${r.targetId}"`,
      `"${r.targetName}"`,
      `"${r.category}"`,
      `"${r.gazeDirection}"`,
      r.stareDurationSeconds.toFixed(1),
      r.dwellTimeSeconds.toFixed(0),
      `"${r.threatLevel}"`,
      r.threatScore,
      `"${r.notes.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sentinel_incident_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              ประวัติการตรวจจับ & เหตุการณ์ (Incident & Detection Logs)
            </h3>
            <p className="text-[11px] text-slate-400">
              บันทึกประวัติการล็อคเป้า ทิศทางการมอง และการตรวจพบบุคคลเฝ้าระวังแบบละเอียด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            disabled={records.length === 0}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            ส่งออก CSV (Export)
          </button>

          {records.length > 0 && (
            <button
              onClick={onClearLogs}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
              title="ล้างประวัติทั้งหมด"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-slate-500 mr-2 flex items-center gap-1">
          <Filter className="w-3 h-3" /> ตัวกรอง:
        </span>
        {[
          { id: "ALL", label: "ทั้งหมด" },
          { id: "CRITICAL", label: "ระดับวิกฤต (Critical)" },
          { id: "SUSPICIOUS", label: "ต้องสงสัย (Suspicious)" },
          { id: "WATCHLIST", label: "บุคคลเฝ้าระวังเท่านั้น" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterLevel(tab.id)}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              filterLevel === tab.id
                ? "bg-cyan-600 text-white font-semibold"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
            <tr>
              <th className="py-2.5 px-3">เวลา (Timestamp)</th>
              <th className="py-2.5 px-3">เป้าหมาย (Target)</th>
              <th className="py-2.5 px-3">ทิศทางการมอง (Gaze)</th>
              <th className="py-2.5 px-3">เวลาในพื้นที่ (Dwell)</th>
              <th className="py-2.5 px-3">ระดับภัยคุกคาม (Threat)</th>
              <th className="py-2.5 px-3">รายละเอียด (Details)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {filtered.length > 0 ? (
              filtered.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{rec.timestamp}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-200">{rec.targetName}</span>
                      {rec.category !== "UNKNOWN" && (
                        <span
                          className={`text-[9px] px-1 rounded ${
                            rec.category === "WANTED"
                              ? "bg-red-500/20 text-red-300"
                              : rec.category === "VIP"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-cyan-500/20 text-cyan-300"
                          }`}
                        >
                          {rec.category}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">{rec.targetId}</div>
                  </td>
                  <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                    <div>{rec.gazeDirection}</div>
                    {rec.stareDurationSeconds > 0 && (
                      <div className="text-[10px] text-red-400 font-semibold">
                        จ้องกล้อง {rec.stareDurationSeconds.toFixed(1)}s
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                    {rec.dwellTimeSeconds.toFixed(0)}s
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.threatLevel === "CRITICAL"
                          ? "bg-red-500/20 text-red-300 border border-red-500/40"
                          : rec.threatLevel === "SUSPICIOUS"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      {rec.threatScore} ({rec.threatLevel})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-[11px] max-w-xs truncate font-sans">
                    {rec.notes}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  ไม่พบข้อมูลประวัติบันทึกตามเงื่อนไขที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
