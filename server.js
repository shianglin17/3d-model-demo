import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { rateLimitMiddleware, getRateLimitStats, cleanupExpiredEntries } from "./rate-limit.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://mongo:27017/sketchfab_demo";

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.static("public"));

// Permissions-Policy: allow only the capabilities needed by the viewer
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    [
      "accelerometer=(self)",
      "gyroscope=(self)",
      "magnetometer=(self)",
      "xr-spatial-tracking=(self)",
      "fullscreen=(self)",
      "autoplay=(self)",
    ].join(", ")
  );
  next();
});

const ModelSchema = new mongoose.Schema(
  {
    uid: { type: String, unique: true, required: true },
    name: String,
    author: String,
    thumbnails: Object,
    raw: Object,
  },
  { timestamps: true }
);

const ModelDoc = mongoose.model("ModelDoc", ModelSchema);

await mongoose.connect(MONGODB_URI);

// 使用 search.js 中的函數

async function getSketchfabCategories() {
  const r = await fetch('https://api.sketchfab.com/v3/categories');
  if (!r.ok) throw new Error("Failed to fetch categories");
  return r.json();
}

// Apply rate limiting to all API routes
app.use("/api", rateLimitMiddleware);

app.post("/api/import/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    // 從請求體獲取模型數據（前端已從 Sketchfab API 獲取）
    const modelData = req.body;

    if (!modelData || !modelData.name) {
      return res.status(400).json({ ok: false, error: '缺少模型數據' });
    }

    const doc = await ModelDoc.findOneAndUpdate(
      { uid },
      {
        uid,
        name: modelData.name || uid,
        author: modelData.user?.displayName || modelData.user?.username || "",
        thumbnails: modelData.thumbnails || {},
        raw: modelData,
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, model: doc });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/models", async (req, res) => {
  const docs = await ModelDoc.find({}).sort({ updatedAt: -1 });
  res.json({ ok: true, models: docs });
});

app.get("/api/models/:uid", async (req, res) => {
  const doc = await ModelDoc.findOne({ uid: req.params.uid });
  if (!doc) return res.status(404).json({ ok: false });
  res.json({ ok: true, model: doc });
});

app.get("/api/model", async (req, res) => {
  const doc = await ModelDoc.findOne({}).sort({ updatedAt: -1 });
  if (!doc) return res.status(404).json({ ok: false });
  res.json({ ok: true, uid: doc.uid });
});

app.delete("/api/models/:uid", async (req, res) => {
  const { uid } = req.params;
  const r = await ModelDoc.deleteOne({ uid });
  if (r.deletedCount === 0) return res.status(404).json({ ok: false });
  res.json({ ok: true, deleted: r.deletedCount });
});

// Rate limit monitoring endpoint
app.get("/api/rate-limit-stats", async (req, res) => {
  try {
    const stats = getRateLimitStats();
    res.json({ ok: true, stats });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Cleanup expired rate limit entries every hour
setInterval(() => {
  cleanupExpiredEntries();
}, 60 * 60 * 1000); // Run every hour

app.listen(PORT, () => console.log("http://localhost:" + PORT));
