/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   MindCheck — MongoDB Schemas + Seed Data            ║
 * ║   Run seed:  node db.js seed                         ║
 * ║   Drop DB:   node db.js drop                         ║
 * ╚══════════════════════════════════════════════════════╝
 *
 *  Install deps:  npm install mongoose
 */

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mindcheck';

/* ══════════════════════════════════════════════════════
   SCHEMA 1 — Assessment
   Stores every completed questionnaire submission.
══════════════════════════════════════════════════════ */
const assessmentSchema = new mongoose.Schema(
  {
    // Anonymous session ID (generated client-side or by server)
    userId: {
      type:    String,
      required: true,
      index:   true,
    },

    // Map of questionId → numeric answer (0–3)
    // e.g. { q1: 2, q2: 0, q3: 3, ... }
    answers: {
      type: Map,
      of:   Number,
    },

    // Optional free-text notes from open questions
    openNotes: {
      type:    Map,
      of:      String,
      default: {},
    },

    // Computed total score (0–57)
    totalScore: {
      type:     Number,
      required: true,
      min:      0,
      max:      57,
    },

    maxScore: { type: Number, default: 57 },

    // Risk level derived from score
    level: {
      type:     String,
      enum:     ['low', 'mid', 'high'],
      required: true,
    },

    // Per-section breakdown
    sectionScores: {
      moodEmotions:    { score: { type: Number, default: 0 }, max: { type: Number, default: 12 } },
      anxietyStress:   { score: { type: Number, default: 0 }, max: { type: Number, default: 12 } },
      sleepEnergy:     { score: { type: Number, default: 0 }, max: { type: Number, default: 12 } },
      socialLifestyle: { score: { type: Number, default: 0 }, max: { type: Number, default: 9  } },
    },

    // List of suggestion titles shown to user
    suggestions: [{ type: String }],

    // When the assessment was completed
    completedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
    collection:  'assessments',
  }
);

// Index for fast user history lookups
assessmentSchema.index({ userId: 1, completedAt: -1 });

/* ══════════════════════════════════════════════════════
   SCHEMA 2 — User Session
   Lightweight record keyed by anonymous userId.
══════════════════════════════════════════════════════ */
const userSchema = new mongoose.Schema(
  {
    userId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    // Running count of completed assessments
    totalAssessments: { type: Number, default: 0 },

    // Convenience: last risk level seen
    lastLevel: { type: String, enum: ['low', 'mid', 'high', null], default: null },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    lastSeen:  { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection:  'users',
  }
);

/* ══════════════════════════════════════════════════════
   MODELS
══════════════════════════════════════════════════════ */
const Assessment = mongoose.model('Assessment', assessmentSchema);
const User       = mongoose.model('User',       userSchema);

/* ══════════════════════════════════════════════════════
   SEED DATA
   Representative examples across all risk levels.
══════════════════════════════════════════════════════ */
const SEED_USERS = [
  { userId: 'seed_user_001', totalAssessments: 3, lastLevel: 'low'  },
  { userId: 'seed_user_002', totalAssessments: 2, lastLevel: 'mid'  },
  { userId: 'seed_user_003', totalAssessments: 1, lastLevel: 'high' },
];

const SEED_ASSESSMENTS = [
  // ── LOW risk example ─────────────────────────────────
  {
    userId:     'seed_user_001',
    answers:    new Map([
      ['q1',0],['q2',0],['q3',3],['q4',0],
      ['q5',1],['q6',0],['q7',3],['q8',0],
      ['q9',3],['q10',0],['q11',0],['q12',0],
      ['q13',3],['q14',0],['q15',3],
    ]),
    openNotes:  new Map([['q16', 'Feeling pretty good lately, just a bit tired sometimes.']]),
    totalScore: 8,
    level:      'low',
    sectionScores: {
      moodEmotions:    { score: 0, max: 12 },
      anxietyStress:   { score: 1, max: 12 },
      sleepEnergy:     { score: 0, max: 12 },
      socialLifestyle: { score: 0, max: 9  },
    },
    suggestions: ['Maintain Healthy Routines', 'Daily Journalling', 'Mindfulness Check-ins'],
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  },

  // ── MODERATE risk example ────────────────────────────
  {
    userId:     'seed_user_002',
    answers:    new Map([
      ['q1',2],['q2',2],['q3',1],['q4',1],
      ['q5',2],['q6',2],['q7',1],['q8',1],
      ['q9',1],['q10',2],['q11',2],['q12',1],
      ['q13',1],['q14',2],['q15',1],
    ]),
    openNotes:  new Map([['q16', 'Work has been really overwhelming. Hard to switch off.']]),
    totalScore: 24,
    level:      'mid',
    sectionScores: {
      moodEmotions:    { score: 7, max: 12 },
      anxietyStress:   { score: 7, max: 12 },
      sleepEnergy:     { score: 6, max: 12 },
      socialLifestyle: { score: 4, max: 9  },
    },
    suggestions: ['Talk to Someone You Trust', 'Stress-Reduction Techniques', 'Reduce Overload', 'Physical Activity'],
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },

  // ── HIGH risk example ────────────────────────────────
  {
    userId:     'seed_user_003',
    answers:    new Map([
      ['q1',3],['q2',3],['q3',0],['q4',3],
      ['q5',3],['q6',3],['q7',0],['q8',3],
      ['q9',0],['q10',3],['q11',3],['q12',3],
      ['q13',0],['q14',3],['q15',0],
    ]),
    openNotes:  new Map([['q16', 'I feel completely hopeless. Nothing feels worth it anymore.']]),
    totalScore: 51,
    level:      'high',
    sectionScores: {
      moodEmotions:    { score: 12, max: 12 },
      anxietyStress:   { score: 12, max: 12 },
      sleepEnergy:     { score: 12, max: 12 },
      socialLifestyle: { score: 9,  max: 9  },
    },
    suggestions: ['Speak to a Professional', 'Use Crisis Helplines if Needed', 'Stay Connected', 'Reduce Stressors'],
    completedAt: new Date(),
  },
];

/* ══════════════════════════════════════════════════════
   CLI COMMANDS
══════════════════════════════════════════════════════ */
async function run() {
  const command = process.argv[2];
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB:', MONGO_URI);

  if (command === 'seed') {
    console.log('\n🌱 Seeding database…');

    await User.deleteMany({ userId: { $in: SEED_USERS.map(u => u.userId) } });
    await Assessment.deleteMany({ userId: { $in: SEED_ASSESSMENTS.map(a => a.userId) } });

    await User.insertMany(SEED_USERS);
    console.log(`   ✔ Inserted ${SEED_USERS.length} users`);

    await Assessment.insertMany(SEED_ASSESSMENTS);
    console.log(`   ✔ Inserted ${SEED_ASSESSMENTS.length} assessments`);

    console.log('\n📊 Sample documents:');
    const sample = await Assessment.findOne({ level: 'mid' }).lean();
    console.log(JSON.stringify(sample, null, 2));

  } else if (command === 'drop') {
    await mongoose.connection.dropDatabase();
    console.log('🗑  Database dropped');

  } else if (command === 'list') {
    const users       = await User.find().lean();
    const assessments = await Assessment.find().select('userId level totalScore completedAt').lean();
    console.log('\n👤 Users:');
    console.table(users.map(u => ({ userId: u.userId, assessments: u.totalAssessments, lastLevel: u.lastLevel })));
    console.log('\n📝 Assessments:');
    console.table(assessments.map(a => ({ userId: a.userId, score: a.totalScore, level: a.level, date: a.completedAt?.toISOString().slice(0,10) })));

  } else {
    console.log(`
Usage:
  node db.js seed   — Insert sample data
  node db.js drop   — Drop the entire database
  node db.js list   — Print all users and assessments
    `);
  }

  await mongoose.disconnect();
  console.log('\n👋 Disconnected');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });

module.exports = { Assessment, User }; // re-use in server.js if needed
