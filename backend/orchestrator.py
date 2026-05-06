from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator
from agents import DebaterAgent, JudgeAgent

TURNS_PER_DEBATER = 3


class DebateOrchestrator:
    def __init__(self, config: dict):
        self.topic = config["topic"]
        self.debaters = [
            DebaterAgent(d["name"], d["persona"], d["stance"])
            for d in config["debaters"]
        ]
        self.judge = JudgeAgent()
        self.history: list[dict] = []
        self._arg_counts: dict[str, int] = {d["name"]: 0 for d in config["debaters"]}

    async def run(self) -> AsyncGenerator[dict, None]:
        total_turns = len(self.debaters) * TURNS_PER_DEBATER

        yield {
            "type": "debate_start",
            "topic": self.topic,
            "total_turns": total_turns,
            "debaters": [
                {"name": d.name, "persona": d.persona, "stance": d.stance}
                for d in self.debaters
            ],
        }

        for turn_index in range(total_turns):
            debater = self.debaters[turn_index % len(self.debaters)]
            self._arg_counts[debater.name] += 1
            arg_num = self._arg_counts[debater.name]

            yield {
                "type": "turn_start",
                "debater": debater.name,
                "turn": turn_index,
                "arg_num": arg_num,
                "total_turns": total_turns,
            }

            argument = ""
            try:
                async for token in debater.argue(self.topic, self.history, arg_num):
                    argument += token
                    yield {
                        "type": "agent_token",
                        "debater": debater.name,
                        "token": token,
                        "turn": turn_index,
                        "arg_num": arg_num,
                    }
            except Exception as e:
                yield {"type": "error", "message": str(e)}
                return

            self.history.append({
                "debater": debater.name,
                "stance": debater.stance,
                "argument": argument,
                "arg_num": arg_num,
            })

            yield {
                "type": "agent_complete",
                "debater": debater.name,
                "turn": turn_index,
                "arg_num": arg_num,
            }

        yield {"type": "debate_end"}
