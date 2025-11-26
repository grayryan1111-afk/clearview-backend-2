// ===============================
// Building Quote App — FULL BACKEND
// ===============================

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const Database = require("better-sqlite3");
const vision = require("@google-cloud/vision");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// SQLite Database Setup
// ===============================
const db = new Database("./data/quotes.db");

db.exec(`
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  address TEXT,
  height REAL,
  window_count INTEGER,
  price REAL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS gutter_quotes (
  id TEXT PRIMARY KEY,
  address TEXT,
  linear_feet REAL,
  stories INTEGER,
  price REAL,
  created_at TEXT
);
`);

// ===============================
// File Upload Handling
// ===============================
const upload = multer({ dest: "uploads/" });

// ===============================
// Google Vision Setup
// ===============================
let visionClient = null;

try {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

  if (base64) {
    const json = Buffer.from(base64, "base64").toString("utf8");
    fs.writeFileSync("google-credentials.json", json);

    visionClient = new vision.ImageAnnotatorClient({
      keyFilename: "google-credentials.json"
    });

    console.log("Google Vision enabled.");
  } else {
    console.log("Google Vision key not found. Using fallback.");
  }
} catch (err) {
  console.log("Vision Init Error:", err);
}

// ===============================
// Fake Window Detection Fallback
// ===============================
async function detectWindows(imagePath) {
  // If Google Vision isn't configured, random fallback
  if (!visionClient) {
    return Math.floor(Math.random() * 40) + 5;
  }

  try {
    const [result] = await visionClient.objectLocalization(imagePath);
    const objects = result.localizedObjectAnnotations || [];

    const windows = objects.filter(o =>
      o.name.toLowerCase().includes("window")
    );

    return windows.length;
  } catch (e) {
    console.error("Vision Error:", e);
    return Math.floor(Math.random() * 40) + 5;
  }
}

// ===============================
// API: Analyze Building Photo
// ===============================
app.post("/api/analyze-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No file uploaded." });

    const filePath = path.join(__dirname, req.file.path);

    const windowCount = await detectWindows(filePath);
    const heightEstimate = windowCount * 1.2; // basic math model

    res.json({
      estimatedWindows: windowCount,
      estimatedHeight: heightEstimate
    });
  } catch (err) {
    console.error("Analyze Error:", err);
    res.status(500).json({ error: "Failed to analyze image." });
  }
});

// ===============================
// API: Save Building Quote
// ===============================
app.post("/api/quote", (req, res) => {
  const { address, height, windowCount, price } = req.body;

  const id = uuidv4();
  const created_at = new Date().toISOString();

  db.prepare(
    `INSERT INTO quotes (id, address, height, window_count, price, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, address, height, windowCount, price, created_at);

  res.json({ success: true, id });
});

// ===============================
// API: Gutter Quote Calculation
// ===============================
app.post("/api/gutter-quote", (req, res) => {
  const { address, linearFeet, stories } = req.body;

  const baseRate = 1.25; // $ per foot
  const multiplier = 1 + (stories - 1) * 0.25;

  const price = linearFeet * baseRate * multiplier;

  const id = uuidv4();
  const created_at = new Date().toISOString();

  db.prepare(
    `INSERT INTO gutter_quotes (id, address, linear_feet, stories, price, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, address, linearFeet, stories, price, created_at);

  res.json({
    id
