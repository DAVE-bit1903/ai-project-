const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const axios     = require('axios');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ✅ Use environment variables ONLY (no localhost in production)
const MONGO_URI = process.env.MONGO_URI;
const ML_URL    = process.env.ML_URL || '';

console.log("🔥 Server starting...");

/* ══════════════════════════════════════
   MIDDLEWARE
══════════════════════════════════════ */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ══════════════════════════════════════
   RATE LIMITING
══════════════════════════════════════ */
const assessmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many submissions. Please try again later.' },
});

/* ══════════════════════════════════════
   MONGODB CONNECTION (NON-BLOCKING)
══════════════════════════════════════ */
if (!MONGO_URI) {
  console.warn("⚠️ MONGO_URI not set. Database will not connect.");
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err.message));
}

/* ══════════════════════════════════════
   SCHEMAS
══════════════════════════════════════ */
const assessmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  answers: { type: Map, of: Number, required: true },
  totalScore: Number,
  level: String,
  suggestions: [String],
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test route
app.get('/', (req, res) => {
  res.send("🚀 Server is running");
});

// Main API
app.post('/api/assessment', assessmentLimiter, async (req, res) => {
  try {
    const { userId, answers } = req.body;

    if (!userId || !answers) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let totalScore = Object.values(answers).reduce((a, b) => a + Number(b), 0);
    let level = getLevel(totalScore);

    const assessment = new Assessment({
      userId,
      answers,
      totalScore,
      level
    });

    await assessment.save();

    res.json({
      success: true,
      totalScore,
      level
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════
   START SERVER (ALWAYS RUNS)
══════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`🧠 Server running on port ${PORT}`);
});
