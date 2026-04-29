const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const axios     = require('axios');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;
const ML_URL = process.env.ML_URL || 'http://localhost:5000';

/* ══════════════════════════════════════
   MIDDLEWARE
══════════════════════════════════════ */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ══════════════════════════════════════
   RATE LIMITING  (max 20 submissions/hour per IP)
══════════════════════════════════════ */
const assessmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ══════════════════════════════════════
   MONGODB CONNECTION
══════════════════════════════════════ */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mindcheck';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected →', MONGO_URI))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

/* ══════════════════════════════════════
   SCHEMAS
══════════════════════════════════════ */
const assessmentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  answers:      { type: Map, of: Number, required: true },
  openNotes:    { type: Map, of: String,  default: {} },
  totalScore:   { type: Number, required: true, min: 0, max: 45 },
  maxScore:     { type: Number, default: 45 },   // fixed: 15 questions × max 3 = 45
  level:        { type: String, enum: ['low', 'mid', 'high'], required: true },
  mlUsed:       { type: Boolean, default: false },
  sectionScores: {
    moodEmotions:    { score: Number, max: Number },
    anxietyStress:   { score: Number, max: Number },
    sleepEnergy:     { score: Number, max: Number },
    socialLifestyle: { score: Number, max: Number },
  },
  suggestions:  [String],
  completedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  userId:            { type: String, required: true, unique: true, index: true },
  createdAt:         { type: Date, default: Date.now },
  lastSeen:          { type: Date, default: Date.now },
  totalAssessments:  { type: Number, default: 0 },
}, { timestamps: true });

const Assessment = mongoose.model('Assessment', assessmentSchema);
const User       = mongoose.model('User', userSchema);

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
// Only used as fallback when ML is unavailable.
// Score range 0–45 (15 questions × 0–3 each, after reverse-scoring).
function getLevel(score) {
  if (score <= 14) return 'low';
  if (score <= 29) return 'mid';
  return 'high';
}

function getSuggestions(level) {
  const map = {
    low:  ['Maintain Healthy Routines', 'Daily Journalling', 'Mindfulness Check-ins'],
    mid:  ['Talk to Someone You Trust', 'Stress-Reduction Techniques', 'Reduce Overload', 'Physical Activity'],
    high: ['Speak to a Professional', 'Use Crisis Helplines if Needed', 'Stay Connected', 'Reduce Stressors'],
  };
  return map[level] || [];
}

// Reverse-scoring question IDs (positive questions scored inverted)
const REVERSE_IDS = new Set(['q3', 'q7', 'q9', 'q13', 'q15']);
const SCALE_Q_IDS = Array.from({ length: 15 }, (_, i) => `q${i + 1}`); // q1–q15

function calcScore(answers) {
  let total = 0;
  for (const qid of SCALE_Q_IDS) {
    let v = Number(answers[qid] ?? 0);
    if (v < 0 || v > 3) v = 0; // sanitise out-of-range values
    if (REVERSE_IDS.has(qid)) v = 3 - v;
    total += v;
  }
  return total; // 0–45
}

/* ══════════════════════════════════════
   ML SERVICE HEALTH POLL
   Polls /health on startup; logs ready when available.
   Prediction calls still fall back gracefully if ML is down.
══════════════════════════════════════ */
async function waitForML(retries = 10, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await axios.get(`${ML_URL}/health`, { timeout: 2000 });
      console.log('🤖 ML service ready →', ML_URL);
      return;
    } catch {
      console.log(`⏳ Waiting for ML service… (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.warn('⚠️  ML service not reachable at startup – will use score fallback.');
}
waitForML();

/* ══════════════════════════════════════
   ROUTES
══════════════════════════════════════ */

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Get assessment history for a userId (lets the frontend sync history from DB)
app.get('/api/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId.length > 80) {
      return res.status(400).json({ error: 'Invalid userId.' });
    }
    const records = await Assessment
      .find({ userId })
      .sort({ completedAt: -1 })
      .limit(10)
      .select('totalScore maxScore level sectionScores completedAt -_id');
    res.json({ success: true, history: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Main submission route
app.post('/api/assessment', assessmentLimiter, async (req, res) => {
  try {
    const { userId, answers, openNotes, sectionScores } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: "'answers' object is required." });
    }

    // userId must be provided by the client (a persistent UUID stored in localStorage)
    if (!userId || typeof userId !== 'string' || userId.length > 80) {
      return res.status(400).json({ error: "'userId' string is required." });
    }

    // Validate all 15 scale questions are present and in range
    const VALID = new Set([0, 1, 2, 3]);
    const missing = SCALE_Q_IDS.filter(qid => !(qid in answers));
    if (missing.length) {
      return res.status(400).json({ error: `Missing answers for: ${missing.join(', ')}.` });
    }

    const outOfRange = SCALE_Q_IDS.filter(qid => !VALID.has(Number(answers[qid])));
    if (outOfRange.length) {
      return res.status(400).json({ error: `Out-of-range values for: ${outOfRange.join(', ')}. Must be 0–3.` });
    }

    // ── Score calculation ───────────────────────────────────────────────────
    const totalScore = calcScore(answers);

    // ── ML prediction (with graceful fallback) ──────────────────────────────
    let level;
    let mlUsed = false;

    try {
      // Only send the 15 scale questions to the model
      const scaleAnswers = {};
      SCALE_Q_IDS.forEach(qid => { scaleAnswers[qid] = Number(answers[qid]); });

      const mlResponse = await axios.post(
        `${ML_URL}/predict`,
        { answers: scaleAnswers },
        { timeout: 5000 }
      );

      level  = mlResponse.data.level;
      mlUsed = true;
      console.log('🤖 ML prediction:', level, '| score:', totalScore);
    } catch (err) {
      console.warn('⚠️  ML unavailable, falling back to score logic. Reason:', err.message);
      level = getLevel(totalScore);
    }

    const suggestions = getSuggestions(level);

    // ── Persist to MongoDB ──────────────────────────────────────────────────
    const assessment = new Assessment({
      userId,
      answers:      new Map(Object.entries(answers)),
      openNotes:    openNotes ? new Map(Object.entries(openNotes)) : {},
      totalScore,
      level,
      mlUsed,
      sectionScores: sectionScores || {},
      suggestions,
    });

    await assessment.save();

    await User.findOneAndUpdate(
      { userId },
      { $inc: { totalAssessments: 1 }, $set: { lastSeen: new Date() } },
      { upsert: true }
    );

    res.status(201).json({
      success: true,
      totalScore,
      maxScore: 45,
      level,
      suggestions,
      mlUsed,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🧠 MindCheck server → http://localhost:${PORT}`);
});
