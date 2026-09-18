import React, { useState, useRef } from "react";
import { WatchlistPerson, TargetCategory, ThreatLevel } from "../types";
import { soundManager } from "../utils/audio";
import {
  Users,
  UserPlus,
  Upload,
  Camera,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Shield,
  Sliders,
  Sparkles,
} from "lucide-react";

interface WatchlistManagerProps {
  watchlist: WatchlistPerson[];
  matchThreshold: number;
  onThresholdChange: (threshold: number) => void;
  onAddTarget: (target: WatchlistPerson) => void;
  onDeleteTarget: (id: string) => void;
  onForceMatch: (id: string) => void;
  activeMatchId: string | null;
  lastCapturedSnapshot: string | null;
  videoElement?: HTMLVideoElement | null;
}

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  watchlist,
  matchThreshold,
  onThresholdChange,
  onAddTarget,
  onDeleteTarget,
  onForceMatch,
  activeMatchId,
  lastCapturedSnapshot,
  videoElement,
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [category, setCategory] = useState<TargetCategory>("WANTED");
  const [alertLevel, setAlertLevel] = useState<ThreatLevel>("CRITICAL");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSnapFromLiveCamera = () => {
    if (videoElement && videoElement.readyState >= 2) {
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setPhotoUrl(dataUrl);
      }
    } else if (lastCapturedSnapshot) {
      setPhotoUrl(lastCapturedSnapshot);
    }
  };

  const handleSubmitNewTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTarget: WatchlistPerson = {
      id: `WL-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      alias: alias.trim() || "บุคคลเฝ้าระวัง",
      category,
      alertLevel,
      photoUrl:
        photoUrl ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80",
      notes: notes.trim() || "บันทึกในฐานข้อมูลความปลอดภัย",
      enrolledAt: new Date().toISOString().split("T")[0],
      threatDescription: notes.trim(),
    };

    onAddTarget(newTarget);
    soundManager.playTargetLocked();

    // Reset
    setName("");
    setAlias("");
    setNotes("");
    setPhotoUrl("");
    setIsAdding(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-100">
                ฐานข้อมูลบุคคลที่ต้องจับตาดูเป็นพิเศษ (Database Watchlist)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-mono">
                เชื่อมต่อ Database: {watchlist.length} รายการ
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              บันทึกข้อมูลจริงเข้าสู่ฐานข้อมูล ถ่ายภาพใบหน้าจากกล้องสด หรืออัปโหลดรูป เพื่อให้ AI ล็อคเป้าและแจ้งเตือน
            </p>
          </div>
        </div>

        <button
          id="add-new-watchlist-btn"
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all active:scale-95"
        >
          <UserPlus className="w-3.5 h-3.5" />
          {isAdding ? "ยกเลิก" : "เพิ่มบุคคลลงฐานข้อมูล"}
        </button>
      </div>

      {/* Threshold Slider */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>เกณฑ์ความมั่นใจในการเทียบใบหน้า (Face Match Threshold):</span>
          <span className="font-mono font-bold text-cyan-400">{matchThreshold}%</span>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-48">
          <input
            type="range"
            min="60"
            max="99"
            value={matchThreshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Add New Target Panel / Modal */}
      {isAdding && (
        <form
          onSubmit={handleSubmitNewTarget}
          className="bg-slate-950 p-4 rounded-xl border border-red-500/40 flex flex-col gap-3 shadow-lg animate-in fade-in duration-200"
        >
          <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            ลงทะเบียนข้อมูลบุคคลเข้าสู่ฐานข้อมูลระบบตรวจการณ์จริง
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">ชื่อ-นามสกุล จริง *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น นายสมเกียรติ สถิตพร หรือ ชื่อบุคคลที่ต้องการเฝ้าระวัง"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">รหัสประจำตัว / แผนก / ข้อมูลอ้างอิง</label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="เช่น แผนกการเงิน หรือ รหัสบัตร หรือ ผู้มาติดต่อ"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">ประเภทการเฝ้าระวัง (Category)</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TargetCategory)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-red-500"
              >
                <option value="WANTED">บุคคลเฝ้าระวังเข้มงวด / ห้ามเข้า (WANTED)</option>
                <option value="SUSPECT">บุคคลต้องสงสัย / ต้องจับตาดู (SUSPECT)</option>
                <option value="VIP">บุคคลสำคัญ (VIP / Board Member)</option>
                <option value="AUTHORIZED">เจ้าหน้าที่ผู้มีสิทธิ์เข้าถึง (AUTHORIZED)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">ระดับการแจ้งเตือน (Alert Priority)</label>
              <select
                value={alertLevel}
                onChange={(e) => setAlertLevel(e.target.value as ThreatLevel)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-red-500"
              >
                <option value="CRITICAL">วิกฤต - แจ้งเตือนฉุกเฉินส่งเข้ามือถือทันที (CRITICAL)</option>
                <option value="SUSPICIOUS">ปานกลาง - แจ้งเตือนแอปพลิเคชันมือถือ (HIGH)</option>
                <option value="NORMAL">ปกติ - บันทึกประวัติการผ่าน (INFO)</option>
              </select>
            </div>
          </div>

          {/* Photo upload / snap options */}
          <div className="flex flex-col gap-2 text-xs">
            <label className="block text-slate-400">รูปถ่ายใบหน้าบุคคลสำหรับให้ AI เทียบเคียง:</label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleSnapFromLiveCamera}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/30"
              >
                <Camera className="w-3.5 h-3.5" />
                ถ่ายภาพใบหน้าจากกล้องสดเดี๋ยวนี้
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                อัปโหลดไฟล์รูปภาพ
              </button>

              {photoUrl && (
                <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  <img src={photoUrl} alt="Preview" className="w-8 h-8 rounded object-cover border border-cyan-500" />
                  <span className="text-[11px] text-emerald-400 font-mono">แนบรูปภาพแล้ว</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1">เหตุผลและบันทึกข้อมูลการเฝ้าระวัง</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุเหตุผลหรือบันทึก เช่น เฝ้าระวังการเข้าออกห้องควบคุม หรือ บุคคลต้องสงสัยป้วนเปี้ยน"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-red-600/30"
            >
              บันทึกเข้าฐานข้อมูล
            </button>
          </div>
        </form>
      )}

      {/* Empty State */}
      {watchlist.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-slate-800/60 text-slate-400 rounded-full">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-300">ฐานข้อมูลบุคคลเฝ้าระวังว่างอยู่</h4>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              ระบบกำลังตรวจการณ์และติดตามบุคคลผ่านกล้องสดแบบเรียลไทม์ คุณสามารถกดปุ่ม <strong>"เพิ่มบุคคลลงฐานข้อมูล"</strong> เพื่อบันทึกรายชื่อและถ่ายภาพใบหน้าจริงเข้าสู่ฐานข้อมูลได้ทันที
            </p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            ลงทะเบียนบุคคลใหม่ตอนนี้
          </button>
        </div>
      ) : (
        /* Watchlist Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {watchlist.map((person) => {
            const isCurrentlyMatched = activeMatchId === person.id;
            const isWanted = person.category === "WANTED";
            const isVip = person.category === "VIP";

            return (
              <div
                key={person.id}
                className={`p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                  isCurrentlyMatched
                    ? "bg-red-950/40 border-red-500 ring-2 ring-red-500/50 shadow-lg shadow-red-500/20"
                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <img
                      src={person.photoUrl}
                      alt={person.name}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-700 shadow-sm shrink-0"
                    />
                    {isCurrentlyMatched && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${
                          isWanted
                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                            : isVip
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}
                      >
                        {person.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{person.id}</span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-100 truncate mt-1" title={person.name}>
                      {person.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">{person.alias}</p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 line-clamp-2 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  {person.notes}
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
                  <button
                    onClick={() => onForceMatch(person.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
                      isCurrentlyMatched
                        ? "bg-red-600 text-white font-bold"
                        : "bg-slate-800 hover:bg-slate-700 text-cyan-300"
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {isCurrentlyMatched ? "ตรวจพบตรงกัน!" : "จับตาดูคนนี้"}
                  </button>

                  <button
                    onClick={() => onDeleteTarget(person.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    title="ลบออกจากฐานข้อมูล"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
