import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  Lock,
  RefreshCw,
  Cpu,
  Code2,
  FileCheck2,
} from "lucide-react";

const PRESET_BRIEFS = [
  {
    id: "saas",
    label: "SaaS Onboarding & Billing",
    text: "Need a fullstack web app for SaaS client onboarding. Users sign up, verify email, connect Stripe billing, and access a React dashboard. Tech stack: React 18, Node.js, Express, PostgreSQL. Timeline: 4 weeks. Budget: $4,500.",
    parsed: {
      type: "Fullstack Web Application",
      stack: ["React 18", "Node.js", "Express", "PostgreSQL", "Stripe API"],
      timeline: "4 Weeks",
      budget: "$4,500",
      confidence: 94,
      riskLevel: "Low",
      riskReason: "Standard auth & billing pattern with clear scope boundaries",
      githubQuery: "topic:stripe-integration language:typescript commits:>20",
      matchScore: "98% Fit",
      matchedDeveloper: "Alex M. (14 verified Stripe/Node repos)",
      milestones: [
        { title: "M1: Architecture & Auth Setup", share: "25%", status: "Ready to Escrow" },
        { title: "M2: Stripe Billing & Webhook Engine", share: "45%", status: "Pending M1" },
        { title: "M3: Client Dashboard & Handoff", share: "30%", status: "Pending M2" },
      ],
    },
  },
  {
    id: "fintech",
    label: "Fintech Webhook & Audit System",
    text: "We need an enterprise Node.js microservice handling high-throughput webhooks with idempotent retries, Redis queues, and SHA-256 transaction audit logging. Must pass security compliance.",
    parsed: {
      type: "Backend Microservice / Infrastructure",
      stack: ["Node.js", "TypeScript", "Redis", "SHA-256 Engine", "AWS Lambda"],
      timeline: "3 Weeks",
      budget: "$6,000",
      confidence: 91,
      riskLevel: "Moderate",
      riskReason: "High-throughput edge cases require strict queue retry policies",
      githubQuery: "topic:redis-queue topic:idempotency commits:>50",
      matchScore: "95% Fit",
      matchedDeveloper: "Sarah T. (Principal Backend Systems Engineer)",
      milestones: [
        { title: "M1: Queue & Idempotency Engine", share: "40%", status: "Ready to Escrow" },
        { title: "M2: SHA-256 Audit Trail Module", share: "40%", status: "Pending M1" },
        { title: "M3: Load Testing & Security Audit", share: "20%", status: "Pending M2" },
      ],
    },
  },
  {
    id: "mobile",
    label: "React Native AI Assistant",
    text: "Build a cross-platform React Native app integrating Gemini AI SDK for voice & text assistance, offline caching, and real-time WebSocket sync with backend.",
    parsed: {
      type: "Cross-Platform Mobile App",
      stack: ["React Native", "Gemini AI API", "WebSockets", "Zustand", "SQLite"],
      timeline: "5 Weeks",
      budget: "$7,200",
      confidence: 89,
      riskLevel: "Moderate",
      riskReason: "WebSocket reconnect logic & mobile audio API edge cases",
      githubQuery: "topic:react-native topic:gemini-ai commits:>30",
      matchScore: "92% Fit",
      matchedDeveloper: "Devon K. (AI & Mobile Lead)",
      milestones: [
        { title: "M1: Core Shell & Gemini AI SDK Integration", share: "30%", status: "Ready to Escrow" },
        { title: "M2: WebSocket Real-time Sync & Caching", share: "45%", status: "Pending M1" },
        { title: "M3: App Store Handoff & QA", share: "25%", status: "Pending M2" },
      ],
    },
  },
];

export function InteractiveBriefSimulator() {
  const [selectedId, setSelectedId] = useState("saas");
  const [customText, setCustomText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("parsed"); // "parsed" | "github" | "milestones"

  const currentPreset = PRESET_BRIEFS.find((b) => b.id === selectedId) || PRESET_BRIEFS[0];
  const briefInputText = customText || currentPreset.text;

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 650);
  };

  const data = currentPreset.parsed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="brief-simulator-container"
    >
      {/* Top Header Badge */}
      <div className="simulator-header">
        <div className="simulator-title-group">
          <motion.span
            whileHover={{ scale: 1.05 }}
            className="simulator-badge cursor-pointer"
          >
            <Cpu size={14} className="animate-spin-slow text-blue-500" />
            FixFlow AI Engine v2.5
          </motion.span>
          <h3 className="simulator-heading">Interactive Brief & Confidence Grid Simulator</h3>
          <p className="simulator-subheading">
            See how FixFlowAI transforms unstructured brief text into structured requirements, GitHub proof matches, and fundable milestone escrows.
          </p>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="simulator-grid">
        {/* Left Column: Brief Input & Presets */}
        <div className="simulator-left-pane">
          <div className="pane-header">
            <span className="pane-label">1. Client Intake Brief</span>
            <div className="preset-pills">
              {PRESET_BRIEFS.map((preset) => (
                <motion.button
                  key={preset.id}
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className={`preset-pill ${selectedId === preset.id && !customText ? "is-active" : ""}`}
                  onClick={() => {
                    setSelectedId(preset.id);
                    setCustomText("");
                    handleRunAnalysis();
                  }}
                >
                  {preset.label}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="input-box-wrapper">
            <textarea
              className="simulator-textarea"
              value={briefInputText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Paste or type any project brief requirement here..."
              rows={4}
            />
            <div className="input-box-actions">
              <span className="char-count">{briefInputText.length} chars</span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="button button--small nav-cta"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Parsing Brief...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Run AI Analysis
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="simulator-stats-banner">
            <motion.div whileHover={{ scale: 1.05 }} className="sim-stat">
              <span className="stat-num">&lt;0.8s</span>
              <span className="stat-lbl">Parsing Speed</span>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="sim-stat">
              <span className="stat-num">{data.confidence}%</span>
              <span className="stat-lbl">Confidence Score</span>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="sim-stat">
              <span className="stat-num">0%</span>
              <span className="stat-lbl">Scope Ambiguity</span>
            </motion.div>
          </div>
        </div>

        {/* Right Column: Dynamic Analysis Output */}
        <div className="simulator-right-pane">
          {/* Navigation Sub-Tabs */}
          <div className="simulator-tabs">
            {[
              { id: "parsed", label: "Structured Requirements", icon: FileCheck2 },
              { id: "github", label: "GitHub Proof Match", icon: GitCommit },
              { id: "milestones", label: "Escrow Milestones", icon: Lock },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 1 }}
                  className={`sim-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon size={15} />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="simTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Tab Content Box */}
          <div className="tab-content-card">
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="analyzing-state-loader"
                >
                  <Cpu size={32} className="animate-spin text-blue-600 mb-2" />
                  <p className="font-semibold text-slate-800 text-sm">Decomposing Brief & Querying GitHub Graph...</p>
                  <span className="text-xs text-slate-500">Scanning verified developer repositories</span>
                </motion.div>
              ) : activeTab === "parsed" ? (
                <motion.div
                  key="parsed"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="parsed-output-view"
                >
                  <div className="output-row">
                    <span className="out-label">Project Type</span>
                    <span className="out-val font-semibold text-slate-900">{data.type}</span>
                  </div>

                  <div className="output-row">
                    <span className="out-label">Extracted Tech Stack</span>
                    <div className="out-tech-tags">
                      {data.stack.map((t, idx) => (
                        <motion.span
                          key={t}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ scale: 1.08 }}
                          className="tech-tag cursor-default"
                        >
                          {t}
                        </motion.span>
                      ))}
                    </div>
                  </div>

                  <div className="output-row-split">
                    <div>
                      <span className="out-label">Est. Duration</span>
                      <span className="out-val text-blue-600 font-bold">{data.timeline}</span>
                    </div>
                    <div>
                      <span className="out-label">Target Budget</span>
                      <span className="out-val text-emerald-600 font-bold">{data.budget}</span>
                    </div>
                    <div>
                      <span className="out-label">Risk Rating</span>
                      <span className={`risk-badge ${data.riskLevel === "Low" ? "risk--low" : "risk--mod"}`}>
                        {data.riskLevel} Risk
                      </span>
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="risk-insight-box"
                  >
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 text-xs block">AI Safety & Scope Insight:</span>
                      <span className="text-xs text-slate-600">{data.riskReason}</span>
                    </div>
                  </motion.div>
                </motion.div>
              ) : activeTab === "github" ? (
                <motion.div
                  key="github"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="github-output-view"
                >
                  <div className="github-query-box">
                    <span className="query-lbl">Automated GitHub Graph Query:</span>
                    <code className="query-code">{data.githubQuery}</code>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="matched-dev-card"
                  >
                    <div className="dev-avatar">
                      <Code2 size={20} className="text-blue-600" />
                    </div>
                    <div className="dev-info">
                      <div className="flex items-center gap-2">
                        <span className="dev-name">{data.matchedDeveloper}</span>
                        <motion.span
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="match-pill"
                        >
                          {data.matchScore}
                        </motion.span>
                      </div>
                      <span className="dev-sub text-xs text-slate-500">
                        Verified GitHub commits & public repository contributions linked to brief requirements.
                      </span>
                    </div>
                  </motion.div>

                  <div className="proof-verification-check">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span className="text-xs text-slate-700 font-medium">
                      Zero resume claims. 100% verified commit history & live production code.
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="milestones"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="milestones-output-view"
                >
                  <div className="milestones-list">
                    {data.milestones.map((m, idx) => (
                      <motion.div
                        key={m.title}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08 }}
                        whileHover={{ scale: 1.01 }}
                        className="milestone-item-row"
                      >
                        <div className="m-num">0{idx + 1}</div>
                        <div className="m-details">
                          <span className="m-title">{m.title}</span>
                          <span className="m-sub">Escrow Allocation: {m.share} of budget</span>
                        </div>
                        <span className="m-status-pill">{m.status}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="escrow-lock-reassurance">
                    <Lock size={15} className="text-blue-600" />
                    <span className="text-xs text-slate-600">
                      Funds locked in milestone escrow prior to step execution. Cryptographic SHA-256 release trail.
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
