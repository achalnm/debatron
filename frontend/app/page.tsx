"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SetupForm from "./components/SetupForm";
import { DebateConfig } from "./types";

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981"];
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/debate";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Argument {
  id: string;
  debater: string;
  persona: string;
  stance: string;
  color: string;
  argNum: number;
  label: string;
  text: string;
  done: boolean;
}

interface DebateState {
  phase: "idle" | "running" | "complete";
  topic: string;
  totalTurns: number;
  debaterMeta: Record<string, { persona: string; stance: string; color: string }>;
  history: { debater: string; stance: string; argument: string; arg_num: number }[];
  args: Argument[];
  shownCount: number;
  streamingId: string | null;
  error: string | null;
}

interface JudgeState {
  open: boolean;
  loading: boolean;
  text: string;
  parsed: Record<string, unknown> | null;
  final: boolean;
}

function argLabel(argNum: number): string {
  if (argNum === 1) return "Opening";
  return `Counter #${argNum - 1}`;
}

export default function Home() {
  const [state, setState] = useState<DebateState>({
    phase: "idle", topic: "", totalTurns: 0, debaterMeta: {}, history: [],
    args: [], shownCount: 0, streamingId: null, error: null,
  });
  const [judge, setJudge] = useState<JudgeState>({
    open: false, loading: false, text: "", parsed: null, final: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.shownCount, state.streamingId]);

  const startDebate = useCallback((config: DebateConfig) => {
    const meta: DebateState["debaterMeta"] = {};
    config.debaters.forEach((d, i) => {
      meta[d.name] = { persona: d.persona, stance: d.stance, color: COLORS[i % COLORS.length] };
    });

    setState({
      phase: "running", topic: config.topic, totalTurns: 0,
      debaterMeta: meta, history: [], args: [], shownCount: 0,
      streamingId: null, error: null,
    });
    setJudge({ open: false, loading: false, text: "", parsed: null, final: false });

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify(config));

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === "debate_start") {
        setState(p => ({ ...p, totalTurns: msg.total_turns }));
      } else if (msg.type === "turn_start") {
        const m = meta[msg.debater];
        const newArg: Argument = {
          id: `${msg.debater}-${msg.turn}`,
          debater: msg.debater,
          persona: m?.persona ?? "",
          stance: m?.stance ?? "",
          color: m?.color ?? COLORS[0],
          argNum: msg.arg_num,
          label: argLabel(msg.arg_num),
          text: "",
          done: false,
        };
        setState(p => ({
          ...p,
          args: [...p.args, newArg],
          streamingId: newArg.id,
          shownCount: p.args.length + 1,
        }));
      } else if (msg.type === "agent_token") {
        setState(p => ({
          ...p,
          args: p.args.map(a => a.id === p.streamingId ? { ...a, text: a.text + msg.token } : a),
        }));
      } else if (msg.type === "agent_complete") {
        const argId = `${msg.debater}-${msg.turn}`;
        setState(p => ({
          ...p,
          streamingId: null,
          args: p.args.map(a => a.id === argId ? { ...a, done: true } : a),
          history: [
            ...p.history,
            { debater: msg.debater, stance: p.debaterMeta[msg.debater]?.stance ?? "", argument: p.args.find(a => a.id === argId)?.text ?? "", arg_num: msg.arg_num },
          ],
        }));
      } else if (msg.type === "debate_end") {
        setState(p => ({ ...p, phase: "complete" }));
      } else if (msg.type === "error") {
        setState(p => ({ ...p, error: msg.message, phase: "idle" }));
      }
    };

    ws.onerror = () => setState(p => ({ ...p, error: "WebSocket failed. Is the backend running?", phase: "idle" }));
    ws.onclose = () => { wsRef.current = null; };
  }, []);

  const reset = () => {
    wsRef.current?.close();
    setState({ phase: "idle", topic: "", totalTurns: 0, debaterMeta: {}, history: [], args: [], shownCount: 0, streamingId: null, error: null });
    setJudge({ open: false, loading: false, text: "", parsed: null, final: false });
  };

  const requestJudge = async (final = false) => {
    setJudge(j => ({ ...j, open: true, loading: true, text: "", parsed: null, final }));
    try {
      const res = await fetch(`${API_URL}/judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: state.topic, history: state.history, final }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        raw += chunk;
        setJudge(j => ({ ...j, text: raw }));
      }
      try {
        const parsed = JSON.parse(raw);
        setJudge(j => ({ ...j, loading: false, parsed }));
      } catch {
        setJudge(j => ({ ...j, loading: false }));
      }
    } catch (err) {
      setJudge(j => ({ ...j, loading: false, text: String(err) }));
    }
  };

  const { args, shownCount, streamingId, phase, topic, totalTurns } = state;
  const visibleArgs = args.slice(0, shownCount);
  const lastVisible = visibleArgs[visibleArgs.length - 1];
  const isStreaming = !!streamingId;
  const canRevealNext = !isStreaming && lastVisible?.done && shownCount < args.length;
  const waitingForNext = !isStreaming && lastVisible?.done && shownCount === args.length && phase === "running";
  const completedCount = args.filter(a => a.done).length;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">Debate Arena</h1>
            {topic && <p className="text-xs text-gray-500 truncate">{topic}</p>}
          </div>

          {phase !== "idle" && (
            <div className="flex items-center gap-2">
              {totalTurns > 0 && (
                <span className="text-xs text-gray-500">{completedCount}/{totalTurns}</span>
              )}
              {state.history.length >= 2 && (
                <button
                  onClick={() => requestJudge(phase === "complete")}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25 border border-yellow-700/50 transition-colors"
                >
                  ⚖ {phase === "complete" ? "Final Verdict" : "Judge"}
                </button>
              )}
              <button onClick={reset} className="text-xs text-gray-500 hover:text-white border border-gray-700 px-2.5 py-1.5 rounded-lg transition-colors">
                ✕ New
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Start a Debate</h2>
                <p className="text-gray-400 text-sm">Pick a preset or configure your own debaters. Read one argument at a time.</p>
              </div>
              {state.error && (
                <div className="mb-5 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">{state.error}</div>
              )}
              <SetupForm onStart={startDebate} />
            </motion.div>
          )}

          {phase !== "idle" && (
            <motion.div key="debate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {visibleArgs.map((arg, idx) => {
                const isLast = idx === visibleArgs.length - 1;
                const isCurrentlyStreaming = isLast && !!streamingId;
                return (
                  <motion.div
                    key={arg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border bg-gray-900 overflow-hidden"
                    style={{
                      borderColor: arg.color + "40",
                      borderLeftColor: arg.color,
                      borderLeftWidth: 4,
                    }}
                  >
                    <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: arg.color }}
                      >
                        {arg.debater[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white text-sm">{arg.debater}</span>
                        <span className="mx-1.5 text-gray-600 text-xs">·</span>
                        <span className="text-xs text-gray-400">{arg.persona}</span>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: arg.color + "22", color: arg.color }}
                      >
                        {arg.label}
                      </span>
                    </div>

                    <div className="px-4 pb-4">
                      <p className="text-gray-200 text-sm leading-relaxed">
                        {arg.text}
                        {isCurrentlyStreaming && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ repeat: Infinity, duration: 0.55 }}
                            className="inline-block w-0.5 h-[14px] bg-indigo-400 ml-0.5 align-middle"
                          />
                        )}
                      </p>
                    </div>
                  </motion.div>
                );
              })}

              {visibleArgs.length === 0 && (
                <div className="text-center py-12 text-gray-600 text-sm">
                  <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                    Generating opening arguments…
                  </motion.span>
                </div>
              )}

              <div ref={bottomRef} />

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  {visibleArgs.length > 0 && `${visibleArgs.length} argument${visibleArgs.length !== 1 ? "s" : ""} shown`}
                </span>

                {isStreaming && (
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} className="text-indigo-400">●</motion.span>
                    Generating…
                  </span>
                )}

                {canRevealNext && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setState(p => ({ ...p, shownCount: p.shownCount + 1 }))}
                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ backgroundColor: lastVisible?.color ?? "#6366f1" }}
                  >
                    Next →
                  </motion.button>
                )}

                {waitingForNext && (
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>●</motion.span>
                    Generating next…
                  </span>
                )}

                {phase === "complete" && !canRevealNext && !isStreaming && (
                  <button
                    onClick={() => requestJudge(true)}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-700/50 hover:bg-yellow-500/30 transition-colors"
                  >
                    ⚖ Final Verdict
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {judge.open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-30"
              onClick={() => setJudge(j => ({ ...j, open: false }))}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-gray-700 z-40 flex flex-col"
            >
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-yellow-300 text-sm">
                    {judge.final ? "Final Verdict" : "Mid-Debate Assessment"}
                  </p>
                  <p className="text-xs text-gray-500">Based on {state.history.length} argument{state.history.length !== 1 ? "s" : ""} so far</p>
                </div>
                <button onClick={() => setJudge(j => ({ ...j, open: false }))} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {judge.loading && !judge.text && (
                  <div className="text-yellow-400/60 text-sm">
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>Deliberating…</motion.span>
                  </div>
                )}

                {judge.parsed ? (
                  <JudgeParsedView data={judge.parsed} final={judge.final} />
                ) : judge.text ? (
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {judge.text}
                    {judge.loading && <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }}>▌</motion.span>}
                  </pre>
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function JudgeParsedView({ data, final }: { data: Record<string, unknown>; final: boolean }) {
  const scores = (data.scores as { debater: string; score?: number; total?: number; note?: string; summary?: string }[]) ?? [];

  return (
    <div className="space-y-5 text-sm">
      {(data.state_of_play || data.verdict) && (
        <div className="bg-yellow-900/20 rounded-xl px-4 py-3">
          <p className="text-xs text-yellow-400 font-semibold mb-1">{final ? "Verdict" : "State of Play"}</p>
          <p className="text-yellow-100">{(data.state_of_play || data.verdict) as string}</p>
        </div>
      )}

      {scores.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scores</p>
          {scores.map((s) => {
            const score = s.score ?? s.total ?? 0;
            const max = final ? 30 : 10;
            return (
              <div key={s.debater} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-xs font-medium">{s.debater}</span>
                  <span className="text-yellow-300 text-xs font-bold">{score}/{max}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(score / max) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-yellow-500"
                  />
                </div>
                {(s.note || s.summary) && <p className="text-gray-500 text-xs">{s.note ?? s.summary}</p>}
              </div>
            );
          })}
        </div>
      )}

      {(data.currently_winning || data.winner) && (
        <div className="bg-green-900/20 rounded-xl px-4 py-3">
          <p className="text-xs text-green-400 font-semibold mb-1">{final ? "Winner" : "Currently Winning"}</p>
          <p className="text-green-200">{(data.currently_winning || data.winner) as string}</p>
        </div>
      )}

      {data.synthesis && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Balanced Answer</p>
          <p className="text-gray-300 leading-relaxed">{data.synthesis as string}</p>
        </div>
      )}

      {(data.watch_for || data.best_exchange) && (
        <div className="bg-indigo-900/20 rounded-xl px-4 py-3">
          <p className="text-xs text-indigo-400 font-semibold mb-1">{final ? "Best Exchange" : "Watch For"}</p>
          <p className="text-indigo-200">{(data.watch_for || data.best_exchange) as string}</p>
        </div>
      )}

      {data.weakest_argument_so_far && (
        <div className="bg-red-900/15 rounded-xl px-4 py-3">
          <p className="text-xs text-red-400 font-semibold mb-1">Weakest Argument</p>
          <p className="text-red-200">
            {(data.weakest_argument_so_far as { debater: string; flaw: string }).debater}: {(data.weakest_argument_so_far as { debater: string; flaw: string }).flaw}
          </p>
        </div>
      )}
    </div>
  );
}
