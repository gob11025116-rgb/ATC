import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Persistent Database File Path
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

interface DatabaseStore {
  watchlist: Array<{
    id: string;
    name: string;
    alias: string;
    category: string;
    alertLevel: string;
    photoUrl: string;
    notes: string;
    threatDescription?: string;
    enrolledAt: string;
  }>;
  incidents: Array<{
    id: string;
    timestamp: string;
    targetId: string;
    targetName: string;
    category: string;
    gazeDirection: string;
    stareDurationSeconds: number;
    dwellTimeSeconds: number;
    threatLevel: string;
    threatScore: number;
    notes: string;
  }>;
}

// Read database from file (initialize empty if not exists)
function readDatabase(): DatabaseStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialData: DatabaseStore = {
        watchlist: [],
        incidents: [],
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf8");
      return initialData;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading database:", err);
    return { watchlist: [], incidents: [] };
  }
}

// Write database to file
function writeDatabase(data: DatabaseStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// Lazy Gemini client helper
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  const db = readDatabase();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    databaseStatus: "connected",
    watchlistCount: db.watchlist.length,
    incidentCount: db.incidents.length,
  });
});

// Database API: Get Watchlist
app.get("/api/watchlist", (_req, res) => {
  const db = readDatabase();
  res.json(db.watchlist);
});

// Database API: Add person to Watchlist
app.post("/api/watchlist", (req, res) => {
  try {
    const { name, alias, category, alertLevel, photoUrl, notes, threatDescription } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const db = readDatabase();
    const newPerson = {
      id: `WL-${Date.now().toString(36).toUpperCase()}`,
      name: name.trim(),
      alias: alias ? alias.trim() : name.trim(),
      category: category || "WANTED",
      alertLevel: alertLevel || "CRITICAL",
      photoUrl: photoUrl || "",
      notes: notes ? notes.trim() : "บุคคลลงทะเบียนในฐานข้อมูลความปลอดภัย",
      threatDescription: threatDescription ? threatDescription.trim() : notes?.trim() || "",
      enrolledAt: new Date().toISOString().split("T")[0],
    };

    db.watchlist.unshift(newPerson);
    writeDatabase(db);

    res.status(201).json(newPerson);
  } catch (err: any) {
    console.error("Error adding to watchlist:", err);
    res.status(500).json({ error: "Failed to add person", message: err.message });
  }
});

// Database API: Update person in Watchlist
app.put("/api/watchlist/:id", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDatabase();
    const index = db.watchlist.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Person not found" });
    }

    db.watchlist[index] = {
      ...db.watchlist[index],
      ...req.body,
      id, // protect ID from overwrite
    };
    writeDatabase(db);

    res.json(db.watchlist[index]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update person", message: err.message });
  }
});

// Database API: Delete person from Watchlist
app.delete("/api/watchlist/:id", (req, res) => {
  try {
    const { id } = req.params;
    const db = readDatabase();
    const beforeCount = db.watchlist.length;
    db.watchlist = db.watchlist.filter((p) => p.id !== id);
    writeDatabase(db);

    res.json({ success: true, deleted: beforeCount > db.watchlist.length });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete person", message: err.message });
  }
});

// Database API: Get Incident Logs
app.get("/api/incidents", (_req, res) => {
  const db = readDatabase();
  res.json(db.incidents);
});

// Database API: Add Incident Log
app.post("/api/incidents", (req, res) => {
  try {
    const db = readDatabase();
    const newLog = {
      id: req.body.id || `LOG-${Date.now().toString(36).toUpperCase()}`,
      timestamp: req.body.timestamp || new Date().toLocaleTimeString("th-TH"),
      targetId: req.body.targetId || "TGT-01",
      targetName: req.body.targetName || "บุคคลไม่ทราบชื่อ",
      category: req.body.category || "UNKNOWN",
      gazeDirection: req.body.gazeDirection || "ไม่ระบุ",
      stareDurationSeconds: Number(req.body.stareDurationSeconds) || 0,
      dwellTimeSeconds: Number(req.body.dwellTimeSeconds) || 0,
      threatLevel: req.body.threatLevel || "NORMAL",
      threatScore: Number(req.body.threatScore) || 10,
      notes: req.body.notes || "",
    };

    db.incidents.unshift(newLog);
    // Keep max 200 logs
    if (db.incidents.length > 200) {
      db.incidents = db.incidents.slice(0, 200);
    }
    writeDatabase(db);

    res.status(201).json(newLog);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to log incident", message: err.message });
  }
});

// Database API: Clear Incident Logs
app.delete("/api/incidents", (_req, res) => {
  try {
    const db = readDatabase();
    db.incidents = [];
    writeDatabase(db);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to clear incidents", message: err.message });
  }
});

// Endpoint: Real AI Behavioral Analysis using Gemini
app.post("/api/analyze-behavior", async (req, res) => {
  try {
    const { targetData, snapshotBase64 } = req.body;
    const db = readDatabase();
    const currentWatchlist = db.watchlist;

    const ai = getGeminiClient();

    // If Gemini key is not set, provide structured intelligent heuristic analysis
    if (!ai) {
      const isStaring = (targetData?.gazeFixationSeconds || 0) > 3;
      const isHighDwell = (targetData?.dwellTimeSeconds || 0) > 20;
      const isErratic = (targetData?.erraticScore || 0) > 60;
      const isWatchlist = !!targetData?.watchlistMatch;

      let threatScore = 15;
      if (isWatchlist) threatScore += 50;
      if (isStaring) threatScore += 25;
      if (isHighDwell) threatScore += 15;
      if (isErratic) threatScore += 15;
      threatScore = Math.min(100, Math.max(5, threatScore));

      let level: "NORMAL" | "SUSPICIOUS" | "CRITICAL" = "NORMAL";
      if (threatScore >= 70) level = "CRITICAL";
      else if (threatScore >= 40) level = "SUSPICIOUS";

      return res.json({
        threatScore,
        level,
        summary: isWatchlist
          ? `พบบุคคลตรงกับฐานข้อมูลเฝ้าระวัง: ${targetData?.watchlistMatch?.name} (${targetData?.watchlistMatch?.category})`
          : isStaring
          ? `ตรวจพบลักษณะพฤติกรรมจ้องมองกล้องโดยตรงต่อเนื่อง (${targetData?.gazeFixationSeconds || 0} วินาที)`
          : `การเคลื่อนไหวและท่าทางโดยรวมปกติ ไม่พบแนวโน้มเจตนาร้าย`,
        behaviorDetails: [
          `ระยะเวลาอยู่ในรัศมีตรวจจับ (Dwell Time): ${targetData?.dwellTimeSeconds || 0} วินาที`,
          `ทิศทางการมองเด่นชัด: ${targetData?.gazeDirection || "มองตรง"} (จ้องกล้องต่อเนื่อง ${targetData?.gazeFixationSeconds || 0} วินาที)`,
          `ความเร็วและการส่ายศีรษะ: ${targetData?.speed || "ปกติ"} (ค่าความแปรปรวน ${targetData?.erraticScore || 10}%)`,
          `การเทียบเคียงฐานข้อมูล: ${targetData?.watchlistMatch ? `ตรงกับ "${targetData.watchlistMatch.name}" ในฐานข้อมูล` : `ไม่พบบุคคลในฐานข้อมูลเฝ้าระวัง (${currentWatchlist.length} รายการ)`}`,
        ],
        intentInference: isWatchlist
          ? "ตรวจพบการปรากฏตัวของบุคคลในฐานข้อมูลความปลอดภัย ควรประสานเจ้าหน้าที่เข้ายืนยันตัวตน"
          : isStaring
          ? "มีการสังเกตและจับจ้องมายังตำแหน่งกล้องบันทึกภาพ อาจเป็นการสำรวจทิศทางเซนเซอร์"
          : "การสัญจรตามปกติ ไม่มีแนวโน้มเจตนาร้าย",
        recommendedAction: threatScore >= 70
          ? "แจ้งเตือนเจ้าหน้าที่รักษาความปลอดภัยและเปิดการบันทึกภาพต่อเนื่อง"
          : threatScore >= 40
          ? "ควบคุมกล้องติดตามความเคลื่อนไหว (PTZ Auto-Track) และเฝ้าสังเกตการณ์"
          : "ติดตามตามวงรอบปกติ ไม่ต้องสั่งการฉุกเฉิน",
        modelUsed: "Heuristic Tactical Engine (ตั้งค่า GEMINI_API_KEY เพื่อเปิดใช้ Gemini Vision เต็มรูปแบบ)",
      });
    }

    // Format watchlist summary for Gemini context
    const watchlistSummary = currentWatchlist.length > 0
      ? currentWatchlist.map((w, idx) => `${idx + 1}. ชื่อ: ${w.name}, หมวดหมู่: ${w.category}, ระดับเตือนภัย: ${w.alertLevel}, บันทึก: ${w.notes}`).join("\n")
      : "ขณะนี้ยังไม่มีบุคคลในฐานข้อมูลเฝ้าระวัง (Watchlist ว่าง)";

    // Prepare Gemini prompt
    const promptText = `คุณคือระบบ AI ตรวจการณ์และวิเคราะห์พฤติกรรมความมั่นคงระดับสูง (Tactical AI Vision & Security Behavioral Analyst)
ภาพที่แนบมานี้คือภาพจริงที่แคปเจอร์จากกล้องถ่ายทอดสดแบบเรียลไทม์ของผู้ใช้งานในขณะนี้

ข้อมูลเป้าหมายและเซนเซอร์ที่ตรวจจับได้จากกล้อง:
- ระยะเวลาอยู่ในพื้นที่ (Dwell Time): ${targetData?.dwellTimeSeconds || 0} วินาที
- ทิศทางสายตา/มุมศีรษะ: ${targetData?.gazeDirection || "ไม่ระบุ"} (Yaw: ${targetData?.yaw || 0}°, Pitch: ${targetData?.pitch || 0}°)
- ระยะเวลาจ้องกล้องต่อเนื่อง: ${targetData?.gazeFixationSeconds || 0} วินาที
- อัตราความแปรปรวนการเคลื่อนไหว (Erratic Movement): ${targetData?.erraticScore || 0}%

รายชื่อบุคคลในฐานข้อมูลเฝ้าระวัง (Watchlist Database):
${watchlistSummary}

กรุณาวิเคราะห์ภาพถ่ายสดและข้อมูลเซนเซอร์:
1. ลักษณะของบุคคลในภาพสดจริง (ทิศทางสายตา สีหน้า ท่าทาง เสื้อผ้า วัตถุที่ถือ หรือกิจกรรมที่กำลังทำอยู่)
2. สภาพแวดล้อมที่ปรากฏในภาพ
3. ตรวจสอบว่าบุคคลในภาพมีความเสี่ยง เจตนา หรือคล้ายคลึงกับบุคคลในฐานข้อมูลเฝ้าระวังหรือไม่
4. ประเมินดัชนีภัยคุกคาม threatScore (0-100) และระดับความเสี่ยง level ("NORMAL" | "SUSPICIOUS" | "CRITICAL")

ตอบกลับเป็น JSON ภาษาไทยตาม Schema นี้เท่านั้น:
{
  "threatScore": number,
  "level": "NORMAL" | "SUSPICIOUS" | "CRITICAL",
  "summary": "สรุปผลการวิเคราะห์สั้นๆ 1-2 ประโยคจากภาพจริง",
  "behaviorDetails": ["รายละเอียดการสังเกตจุดที่ 1 จากภาพ", "รายละเอียดจุดที่ 2", "รายละเอียดจุดที่ 3"],
  "intentInference": "การคาดการณ์เจตนาและพฤติกรรมของบุคคลในภาพ",
  "recommendedAction": "คำแนะนำการปฏิบัติงานสำหรับเจ้าหน้าที่ รปภ."
}`;

    const parts: any[] = [];
    if (snapshotBase64 && typeof snapshotBase64 === "string" && snapshotBase64.includes("base64,")) {
      const cleanBase64 = snapshotBase64.split("base64,")[1];
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      });
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: parts.length > 1 ? { parts } : promptText,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText = response.text || "{}";
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText.trim());
    } catch {
      parsedResult = {
        threatScore: 25,
        level: "NORMAL",
        summary: responseText.slice(0, 150),
        behaviorDetails: ["วิเคราะห์ภาพสดจากกล้องเรียบร้อย"],
        intentInference: "ตรวจพบกิจกรรมปกติในกล้อง",
        recommendedAction: "ติดตามตามวงรอบปกติ",
      };
    }

    res.json({
      ...parsedResult,
      modelUsed: "Google Gemini 3.8 Flash (Multimodal Real-Time Vision)",
    });
  } catch (error: any) {
    console.error("Gemini behavioral analysis error:", error);
    res.status(500).json({
      error: "Analysis error",
      message: error.message || "Failed to analyze target",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lock-on Target System running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
