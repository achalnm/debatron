# Debate Arena

A multi-agent debate simulator. Configure 2–4 AI debaters with custom personas and stances, pick a topic, and watch them argue in real time - with a judge that scores performance mid-debate and delivers a final verdict.

## How it works

The frontend connects to the backend over a persistent WebSocket. When a debate starts, the orchestrator runs debaters in a round-robin sequence (3 turns each), streaming every token back to the client as it arrives from the Gemini API. Arguments reveal one at a time - you press "Next" to advance, which keeps the debate readable rather than dumping everything at once.

The judge is a separate endpoint (`POST /judge`) that takes the debate history and returns structured JSON: per-debater scores, a state-of-play summary, the current leader, and a synthesis paragraph. Mid-debate assessments are available after 2+ arguments; the final verdict triggers automatically when the debate ends.

## Stack

- **Backend** - Python 3.11+, FastAPI, Uvicorn, WebSockets, `httpx` (raw SSE calls to the Gemini REST API - no SDK)
- **Frontend** - Next.js 15, TypeScript, Tailwind CSS, Framer Motion
- **Model** - Gemini 2.5 Flash via Google AI Studio

## Setup

### 1. Get a Gemini API key

Create a free key at https://aistudio.google.com/apikey.

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and paste your key:

```
GEMINI_API_KEY=your-actual-key-here
```

### 3. Run the backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

API runs at `http://localhost:8000`. The `/health` endpoint confirms it's up.

### 4. Run the frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

### 5. Open the app

Go to `http://localhost:3000`.

## Notes

**Quota** - Gemini 2.5 Flash has a low free-tier daily quota. If you hit a `429`, either wait until midnight Pacific time for it to reset, or switch to `gemini-2.0-flash` in `backend/agents.py` (same API shape, much higher free limits).

**Deployment** - CORS is configured for `localhost:3000` and `*.vercel.app`. If you deploy the backend elsewhere, update `allow_origins` in `backend/main.py`. Set `NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_API_URL` in your frontend environment to point at the deployed backend.
