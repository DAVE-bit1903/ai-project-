# 🧠 MindCheck — Mental Wellness Screening App

> A privacy-first, rule-based mental health screening tool.  
> **Not a diagnosis. For awareness and personal reflection only.**

---

## 📁 Project Structure

```
mindcheck/
├── public/
│   └── index.html      ← Frontend (copy index.html here)
├── server.js           ← Express backend + all API routes
├── db.js               ← Mongoose schemas + seed/drop CLI
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Make sure MongoDB is running
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 3. Seed sample data (optional)
```bash
npm run seed
```

### 4. Start the server
```bash
npm start
# or for hot-reload during dev:
npm run dev
```

### 5. Open the app
```
http://localhost:3000
```

---

## 🔌 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET  | `/api/health` | Server + DB status check |
| POST | `/api/assessment` | Save a new assessment |
| GET  | `/api/assessment/:userId` | Get all assessments for a user |
| GET  | `/api/assessment/detail/:id` | Get one assessment by MongoDB `_id` |
| GET  | `/api/stats/:userId` | Trend stats (avg, min, max, timeline) |
| DELETE | `/api/assessment/:id` | Delete one assessment |

### POST `/api/assessment` — Request Body
```json
{
  "userId": "user_abc123",
  "answers": {
    "q1": 2, "q2": 1, "q3": 3,
    "q4": 0, "q5": 2, "q6": 1,
    "q7": 2, "q8": 0, "q9": 1,
    "q10": 2, "q11": 1, "q12": 0,
    "q13": 3, "q14": 0, "q15": 2
  },
  "openNotes": {
    "q16": "Feeling okay but stressed at work."
  },
  "sectionScores": {
    "moodEmotions":    { "score": 4, "max": 12 },
    "anxietyStress":   { "score": 5, "max": 12 },
    "sleepEnergy":     { "score": 4, "max": 12 },
    "socialLifestyle": { "score": 2, "max": 9 }
  }
}
```

---

## 📊 Scoring Logic

| Total Score | Risk Level |
|-------------|------------|
| 0 – 15      | 🟢 Low     |
| 16 – 32     | 🟡 Moderate|
| 33 – 57     | 🔴 High    |

Answer values: `Never = 0 | Sometimes = 1 | Often = 2 | Always = 3`  
Reversed questions (q3, q7, q9, q13, q15): `val = 3 - val`

---

## 🗄 Database CLI Commands

```bash
npm run seed      # Insert 3 sample users + assessments
npm run list-db   # Print all data to console
npm run drop-db   # Wipe the entire database (careful!)
```

---

## 🌐 Deploying for Free

| Layer    | Service |
|----------|---------|
| Frontend | [Netlify](https://netlify.com) — drag & drop `public/` folder |
| Backend  | [Render](https://render.com) — connect GitHub repo, set `npm start` |
| Database | [MongoDB Atlas](https://cloud.mongodb.com) — free M0 cluster, set `MONGO_URI` env var |

### Render Environment Variables
```
MONGO_URI = mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/mindcheck
PORT      = 3000
```

---

## ⚠️ Disclaimer

This application is a **wellness awareness tool only**.  
It does not provide medical diagnoses.  
If you are in distress, please contact a mental health professional.

**India Crisis Lines:**
- iCall: `9152987821`
- Vandrevala Foundation: `1860-2662-345` (24/7)

---

## 🔮 Phase 2 Roadmap

- [ ] User authentication (JWT)
- [ ] Mood tracking chart (Chart.js)
- [ ] AI-powered chatbot (Claude API)
- [ ] Email reminders (Nodemailer)
- [ ] ML model integration (Python Flask microservice)
- [ ] PWA / mobile app
