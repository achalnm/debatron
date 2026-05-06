"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DebateConfig, DebaterConfig } from "../types";

interface Props {
  onStart: (config: DebateConfig) => void;
}

const PRESETS: { label: string; config: DebateConfig }[] = [
  {
    label: "Remote Work",
    config: {
      topic: "Should remote work be the default for knowledge workers?",
      debaters: [
        { name: "Sarah Chen", persona: "Fortune 500 CEO who rebuilt company culture post-pandemic", stance: "In-office is essential for innovation and culture" },
        { name: "Marcus Webb", persona: "Distributed team advocate and author of 'Remote by Design'", stance: "Remote-first is the future of high-performance work" },
        { name: "Dr. Priya Nair", persona: "Urban economist studying city-centre vacancy rates", stance: "Hybrid models optimise for both outcomes" },
      ],
    },
  },
  {
    label: "AGI Timeline",
    config: {
      topic: "Is AGI achievable within the next 10 years?",
      debaters: [
        { name: "Dr. Elara Voss", persona: "AI safety researcher at a leading alignment institute", stance: "AGI in 10 years is dangerously optimistic and technically unfounded" },
        { name: "Kai Okafor", persona: "Researcher at a frontier AI lab who ships models weekly", stance: "Current scaling trajectories make AGI within a decade highly plausible" },
        { name: "Prof. Leo Harrington", persona: "Philosopher of mind specialising in the hard problem of consciousness", stance: "The question is unanswerable without first defining intelligence" },
      ],
    },
  },
  {
    label: "Social Media",
    config: {
      topic: "Does social media do more harm than good to society?",
      debaters: [
        { name: "Jenna Park", persona: "Big Tech product director who shipped a billion-user feature", stance: "Social media is net positive — connectivity and information access outweigh harms" },
        { name: "Dr. Sam Torres", persona: "Teen mental health researcher with 15 years of clinical data", stance: "The evidence is clear: social media is causing a youth mental health crisis" },
        { name: "Anya Bloom", persona: "Free speech journalist who covered the Arab Spring", stance: "Regulation will do more harm than the platforms themselves" },
      ],
    },
  },
  {
    label: "Ban Cars",
    config: {
      topic: "Should major city centres ban private cars entirely?",
      debaters: [
        { name: "Tomas Reyes", persona: "Urban planner behind Oslo's car-free city centre project", stance: "Banning private cars creates safer, healthier, more equitable cities" },
        { name: "Fiona Walsh", persona: "Taxi and ride-share driver, small business owner", stance: "Car bans punish working people and destroy livelihoods" },
        { name: "Dr. Amara Cole", persona: "Climate scientist focused on transport emissions", stance: "A phased ban with strong public transit investment is the only climate-compatible path" },
      ],
    },
  },
  {
    label: "Universal Basic Income",
    config: {
      topic: "Should governments implement Universal Basic Income?",
      debaters: [
        { name: "Prof. Ravi Singh", persona: "Economist who ran a landmark UBI pilot in Finland", stance: "UBI is the most effective tool we have against automation-driven poverty" },
        { name: "Claire Novak", persona: "Fiscal conservative think-tank director", stance: "UBI is fiscally ruinous and will destroy work incentives" },
        { name: "Denise Obi", persona: "Community organiser in a post-industrial rust-belt city", stance: "UBI alone is insufficient — we need jobs and investment, not cash transfers" },
      ],
    },
  },
];

const DEBATER_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981"];

export default function SetupForm({ onStart }: Props) {
  const [topic, setTopic] = useState("");
  const [debaters, setDebaters] = useState<DebaterConfig[]>([
    { name: "", persona: "", stance: "" },
    { name: "", persona: "", stance: "" },
  ]);

  const loadPreset = (preset: (typeof PRESETS)[0]) => {
    setTopic(preset.config.topic);
    setDebaters(preset.config.debaters);
  };

  const updateDebater = (i: number, field: keyof DebaterConfig, value: string) => {
    setDebaters((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)));
  };

  const addDebater = () => {
    if (debaters.length < 4) setDebaters((prev) => [...prev, { name: "", persona: "", stance: "" }]);
  };

  const removeDebater = (i: number) => {
    if (debaters.length > 2) setDebaters((prev) => prev.filter((_, idx) => idx !== i));
  };

  const canStart =
    topic.trim().length > 0 &&
    debaters.every((d) => d.name.trim() && d.persona.trim() && d.stance.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canStart) onStart({ topic, debaters });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick start — choose a preset</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => loadPreset(p)}
              className="px-3 py-1.5 rounded-full border border-gray-700 text-sm text-gray-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Debate Topic</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Should AI systems be open-sourced?"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-300">Debaters ({debaters.length}/4)</label>
          {debaters.length < 4 && (
            <button
              type="button"
              onClick={addDebater}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Add debater
            </button>
          )}
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {debaters.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-gray-700 p-4 space-y-3"
                style={{ borderLeftColor: DEBATER_COLORS[i], borderLeftWidth: 3 }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: DEBATER_COLORS[i] }}
                  >
                    Debater {i + 1}
                  </span>
                  {debaters.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeDebater(i)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    value={d.name}
                    onChange={(e) => updateDebater(i, "name", e.target.value)}
                    placeholder="Name"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={d.persona}
                    onChange={(e) => updateDebater(i, "persona", e.target.value)}
                    placeholder="Persona / background"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={d.stance}
                    onChange={(e) => updateDebater(i, "stance", e.target.value)}
                    placeholder="Assigned stance"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canStart}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold transition-colors text-sm"
      >
        Start Debate
      </button>
    </form>
  );
}
