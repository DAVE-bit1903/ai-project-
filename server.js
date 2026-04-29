const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

console.log("🔥 App is starting...");

/* ══════════════════════════════════════
   MIDDLEWARE
══════════════════════════════════════ */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ══════════════════════════════════════
   RATE LIMIT
══════════════════════════════════════ */
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
});
app.use(limiter);

/* ══════════════════════════════════════
   MONGODB CONNECTION (SAFE)
══════════════════════════════════════ */
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn("⚠️ No MONGO_URI provided");
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB error:", err.message));
}

/* ══════════════════════════════════════
   SCHEMA
══════════════════════════════════════ */
const assessmentSchema = new mongoose.Schema({
  userId: String,
  answers: Object,
  totalScore: Number,
  level: String
}, { timestamps: true });

const Assessment = mongoose.model('Assessment', assessmentSchema);

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function getLevel(score) {
  if (score <= 14) return 'low';
  if (score <= 29) return 'mid';
  return 'high';
}

/* ══════════════════════════════════════
   ROUTES
══════════════════════════════════════ */

// Root test route (IMPORTANT for port detection)
app.get('/', (req, res) => {
  res.send("🚀 Server is LIVE");
});

// Health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main API
app.post('/api/assessment', async (req, res) => {
  try {
    const { userId, answers } = req.body;

    if (!userId || !answers) {
      return res.status(400).json({ error: "Missing data" });
    }

    const totalScore = Object.values(answers)
      .reduce((sum, val) => sum + Number(val), 0);

    const level = getLevel(totalScore);

    const data = new Assessment({
      userId,
      answers,
      totalScore,
      level
    });

    await data.save();

    res.json({ success: true, totalScore, level });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════
   START SERVER (CRITICAL)
══════════════════════════════════════ */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧠 Server running on port ${PORT}`);
});
