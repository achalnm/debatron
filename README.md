# Debate Arena

A multi-agent debate simulator. Configure 2 to 4 AI debaters with custom personas and stances, pick a topic, and watch them argue in real time, with a judge that scores performance mid-debate and delivers a final verdict.

## How it works

The frontend connects to the backend over a persistent WebSocket. When a debate starts, the orchestrator runs the debaters in a round-robin sequence (3 turns each) and streams every token back to the client as it arrives from the Gemini API. Arguments reveal one at a time, and you press "Next" to advance, which keeps the debate readable rather than dumping everything at once.

The judge is a separate endpoint (POST /judge) that takes the debate history and streams back an assessment. It is prompted to return a structured result (per-debater scores, who is currently ahead, and a short synthesis), which the interface renders as a scorecard, with a plain-text fallback if the model's output does not parse as JSON. Mid-debate assessments are available after 2 or more arguments, and the final verdict triggers automatically when the debate ends.

## Bring your own API key

This project does not ship with an API key, and it cannot, for two reasons. An API key is a private credential tied to your own Google account and billing, so committing one to a public repository would let anyone spend against your quota, which is why the key lives only in a local .env file that is gitignored. Beyond the security point, it also keeps the project free to run: each person uses their own free Gemini key from Google AI Studio rather than sharing one shared, rate-limited key. So you supply your own key once, store it locally, and the app uses it to call the model.

### Getting and setting your key

1. Create a free Gemini API key at https://aistudio.google.com/apikey
2. In the backend folder, copy the example env file:

```
cd backend
cp .env.example .env
```

3. Open backend/.env and paste your key:

```
GEMINI_API_KEY=your-actual-key-here
```

The .env file stays on your machine and is ignored by git, so your key is never committed or shared.

## Stack

- Backend: Python 3.11 or newer, FastAPI, Uvicorn, WebSockets, httpx (raw SSE calls to the Gemini REST API, no SDK)
- Frontend: Next.js 15, TypeScript, Tailwind CSS, Framer Motion
- Model: Gemini 2.5 Flash via Google AI Studio

## Setup

### 1. Configure and run the backend

After setting your key as described above:

```
cd backend
pip install -r requirements.txt
python main.py
```

The API runs at http://localhost:8000. The /health endpoint confirms it is up.

### 2. Run the frontend

In a separate terminal:

```
cd frontend
npm install
npm run dev
```

### 3. Open the app

Go to http://localhost:3000.

## Notes

Quota: Gemini 2.5 Flash has a low free-tier daily quota. If you hit a 429, either wait until it resets at midnight Pacific time, or switch to gemini-2.0-flash in backend/agents.py (same API shape, higher free limit).

Deployment: CORS is configured for localhost:3000 and *.vercel.app. If you deploy the backend elsewhere, update allow_origins in backend/main.py, and set NEXT_PUBLIC_WS_URL and NEXT_PUBLIC_API_URL in your frontend environment to point at the deployed backend.
