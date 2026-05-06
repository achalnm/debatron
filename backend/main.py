import os
import json
from typing import List
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from orchestrator import DebateOrchestrator
from agents import JudgeAgent

app = FastAPI(title="Debate Arena API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_judge = JudgeAgent()


class DebaterConfig(BaseModel):
    name: str
    persona: str
    stance: str


class DebateConfig(BaseModel):
    topic: str
    debaters: List[DebaterConfig]


class JudgeRequest(BaseModel):
    topic: str
    history: list
    final: bool = False


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/judge")
async def judge_endpoint(body: JudgeRequest):
    async def generate():
        try:
            gen = _judge.final_verdict if body.final else _judge.mid_game_assess
            async for token in gen(body.topic, body.history):
                yield token
        except Exception as e:
            yield f"\n[Error: {str(e)}]"

    return StreamingResponse(generate(), media_type="text/plain")


@app.websocket("/debate")
async def debate_ws(websocket: WebSocket):
    await websocket.accept()

    try:
        raw = await websocket.receive_json()
        config = DebateConfig(**raw)

        if len(config.debaters) < 2 or len(config.debaters) > 4:
            await websocket.send_json({
                "type": "error",
                "message": "Debate requires 2–4 debaters."
            })
            await websocket.close()
            return

        orchestrator = DebateOrchestrator(config.model_dump())

        async for event in orchestrator.run():
            await websocket.send_json(event)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
