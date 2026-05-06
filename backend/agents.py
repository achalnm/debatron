from __future__ import annotations

import json
import os
import httpx
from typing import AsyncGenerator
from prompts import DEBATER_SYSTEM, MID_JUDGE_SYSTEM, FINAL_JUDGE_SYSTEM

MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent"
)


async def _stream_gemini(
    system: str, content: str, max_tokens: int
) -> AsyncGenerator[str, None]:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": content}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST", GEMINI_URL, json=payload,
            params={"key": api_key, "alt": "sse"},
        ) as response:
            if response.status_code == 429:
                raise RuntimeError(
                    "Gemini daily quota exceeded. Your free API key has hit its limit — "
                    "it resets at midnight Pacific time. Get a new key at "
                    "https://aistudio.google.com/apikey or wait until tomorrow."
                )
            elif response.status_code != 200:
                body = await response.aread()
                raise RuntimeError(
                    f"Gemini API error {response.status_code}: {body.decode()[:200]}"
                )
            else:
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        data = json.loads(raw)
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        if text:
                            yield text
                    except (KeyError, IndexError, json.JSONDecodeError):
                        continue
                return  # success


class DebaterAgent:
    def __init__(self, name: str, persona: str, stance: str):
        self.name = name
        self.persona = persona
        self.stance = stance
        self.system = DEBATER_SYSTEM.format(name=name, persona=persona, stance=stance)

    async def argue(
        self, topic: str, history: list[dict], arg_num: int
    ) -> AsyncGenerator[str, None]:
        content = self._build_content(topic, history, arg_num)
        async for token in _stream_gemini(self.system, content, max_tokens=200):
            yield token

    def _build_content(self, topic: str, history: list[dict], arg_num: int) -> str:
        content = f"Debate topic: {topic}\n\n"

        if arg_num == 1:
            content += "This is your opening statement. State your position clearly and compellingly in one paragraph."
        else:
            content += "The debate so far:\n\n"
            for entry in history:
                label = "Opening" if entry["arg_num"] == 1 else f"Argument #{entry['arg_num']}"
                content += f"[{entry['debater']} — {label}]\n{entry['argument']}\n\n"
            content += (
                f"This is your argument #{arg_num}. "
                "In one paragraph, counter the most recent argument above. Name the person. Be specific and sharp."
            )

        return content


class JudgeAgent:
    async def mid_game_assess(
        self, topic: str, history: list[dict]
    ) -> AsyncGenerator[str, None]:
        content = f"Debate topic: {topic}\n\nDebate so far:\n\n"
        for entry in history:
            label = "Opening" if entry["arg_num"] == 1 else f"Argument #{entry['arg_num']}"
            content += f"[{entry['debater']} — {label}]\n{entry['argument']}\n\n"
        content += "Give your mid-debate assessment."
        async for token in _stream_gemini(MID_JUDGE_SYSTEM, content, max_tokens=400):
            yield token

    async def final_verdict(
        self, topic: str, history: list[dict]
    ) -> AsyncGenerator[str, None]:
        content = f"Debate topic: {topic}\n\nFull debate:\n\n"
        for entry in history:
            label = "Opening" if entry["arg_num"] == 1 else f"Argument #{entry['arg_num']}"
            content += f"[{entry['debater']} — {label}]\n{entry['argument']}\n\n"
        content += "Deliver your final verdict."
        async for token in _stream_gemini(FINAL_JUDGE_SYSTEM, content, max_tokens=600):
            yield token
