"use client";
import { useState, useRef, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { api, apiBase } from "@/lib/api";
import { Bot, Send, Loader, Check, Users, MessageSquare, Radio, Eye, Rocket, AlertCircle } from "lucide-react";

interface AgentStep {
  step: number;
  type: string;
  message?: string;
  segment?: { name: string; filter_rules: object };
  count?: number;
  sample?: { name: string }[];
  reasoning?: string;
  channel?: string;
  campaign?: {
    name: string; segment_name: string; audience_count: number;
    message: string; channel: string; subject?: string; filter_rules: object;
  };
}

const STEP_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  audience_finding: { icon: <Users size={16} />, label: "Finding Audience", color: "var(--accent-blue)" },
  audience_result: { icon: <Users size={16} />, label: "Audience Identified", color: "var(--accent-green)" },
  message_generating: { icon: <MessageSquare size={16} />, label: "Drafting Message", color: "var(--accent-purple)" },
  message_draft: { icon: <MessageSquare size={16} />, label: "Message Ready", color: "var(--accent-purple)" },
  channel_recommendation: { icon: <Radio size={16} />, label: "Channel Selected", color: "var(--accent-cyan)" },
  campaign_preview: { icon: <Eye size={16} />, label: "Campaign Preview", color: "var(--accent-orange)" },
};

const CHANNEL_ICONS: Record<string, string> = { whatsapp: "💬", email: "📧", sms: "📱", rcs: "✨" };

const GOALS = [
  "Recover inactive premium customers who haven't bought in 90 days",
  "Promote new collection launch to gold and platinum customers",
  "Re-engage churned customers with a win-back offer",
  "Run a loyalty reward campaign for top spenders",
];

export default function AgentPage() {
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState<{ message: string; campaign: AgentStep["campaign"] } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [launched, setLaunched] = useState<{ campaign_id: string; recipient_count: number } | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps, awaitingConfirm]);

  const handleStart = async () => {
    if (!goal.trim() || streaming) return;
    setSteps([]);
    setAwaitingConfirm(null);
    setLaunched(null);
    setError("");
    setStreaming(true);

    const token = localStorage.getItem("xeno_token");
    const res = await fetch(`${apiBase}/api/ai/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ goal }),
    });

    if (!res.ok || !res.body) {
      setError("Failed to start agent. Please check your API key and try again.");
      setStreaming(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastEventType = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          lastEventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));

            if (lastEventType === "awaiting_confirmation" || data.campaign) {
              setAwaitingConfirm(data);
            } else if (data.step !== undefined) {
              setSteps(prev => {
                // Avoid duplicate type entries — update in place
                const idx = prev.findIndex(s => s.type === data.type);
                if (idx !== -1) {
                  const updated = [...prev];
                  updated[idx] = data;
                  return updated;
                }
                return [...prev, data];
              });
            }
            // Reset after data consumed
            if (line.trim()) lastEventType = "";
          } catch { /* ignore parse errors */ }
        }
      }
    }

    setStreaming(false);
  };

  const handleConfirm = async () => {
    if (!awaitingConfirm?.campaign) return;
    setConfirming(true);
    try {
      const camp = awaitingConfirm.campaign;
      const result = await api.post("/api/ai/agent/confirm", {
        name: camp.name,
        filter_rules: camp.filter_rules,
        message: camp.message,
        channel: camp.channel,
      });
      setLaunched(result);
    } catch (e: unknown) {
      setError((e as Error).message || "Launch failed");
    } finally {
      setConfirming(false);
    }
  };

  const reset = () => {
    setGoal("");
    setSteps([]);
    setAwaitingConfirm(null);
    setLaunched(null);
    setError("");
    setStreaming(false);
  };

  return (
    <AppLayout>
      <div className="animate-fade-in" style={{ maxWidth: 760 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "var(--gradient-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 24px rgba(79,142,247,0.4)",
            }}>
              <Bot size={22} color="white" />
            </div>
            <div>
              <h1 className="section-title" style={{ fontSize: 24 }}>AI Campaign Agent</h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Describe your goal — AI builds the entire campaign</p>
            </div>
          </div>
        </div>

        {/* Goal input */}
        <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, rgba(79,142,247,0.08) 0%, rgba(168,85,247,0.08) 100%)", border: "1px solid rgba(79,142,247,0.25)" }}>
          <label className="label">What's your marketing goal?</label>
          <textarea
            className="input"
            style={{ minHeight: 70, marginBottom: 12 }}
            placeholder="e.g. Recover inactive premium customers who haven't purchased in 90 days..."
            value={goal}
            onChange={e => setGoal(e.target.value)}
            disabled={streaming}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {GOALS.map(g => (
              <button key={g} className="btn-ghost" style={{ fontSize: 11, border: "1px solid var(--border)", padding: "4px 10px" }}
                onClick={() => setGoal(g)} disabled={streaming}>
                {g.length > 40 ? g.slice(0, 40) + "..." : g}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={handleStart} disabled={streaming || !goal.trim()} style={{ flex: 1, justifyContent: "center" }}>
              {streaming
                ? <><Loader size={16} className="animate-spin" />Agent Running...</>
                : <><Send size={16} />Run Agent</>}
            </button>
            {(steps.length > 0 || launched) && !streaming && (
              <button className="btn-secondary" onClick={reset}>New Goal</button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "14px 16px", background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10,
            display: "flex", gap: 10, alignItems: "center", marginBottom: 16,
            color: "var(--accent-red)", fontSize: 13,
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Step Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((s, i) => {
            const config = STEP_CONFIG[s.type] || { icon: <Bot size={16} />, label: s.type, color: "var(--text-secondary)" };
            return (
              <div key={i} className="card animate-fade-in" style={{ borderLeft: `3px solid ${config.color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ color: config.color }}>{config.icon}</div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: config.color }}>{config.label}</span>
                  <Check size={14} style={{ color: "var(--accent-green)", marginLeft: "auto" }} />
                </div>

                {s.type === "audience_result" && (
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent-green)", marginBottom: 4 }}>
                      {s.count?.toLocaleString()} customers
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{s.segment?.name}</div>
                    {s.reasoning && <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.reasoning}</div>}
                    {s.sample && s.sample.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {s.sample.map((c, j) => (
                          <span key={j} style={{
                            padding: "4px 12px", borderRadius: 20, fontSize: 12,
                            background: "var(--bg-hover)", border: "1px solid var(--border)",
                          }}>{c.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {s.type === "message_draft" && (
                  <div style={{
                    padding: 14, background: "var(--bg-secondary)", borderRadius: 8,
                    fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap",
                  }}>
                    {s.message}
                  </div>
                )}

                {s.type === "channel_recommendation" && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
                      {CHANNEL_ICONS[s.channel ?? ""] ?? "📨"} {s.channel?.toUpperCase()}
                    </div>
                    {s.reasoning && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.reasoning}</div>}
                  </div>
                )}

                {(s.type === "audience_finding" || s.type === "message_generating") && s.message && (
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{s.message}</div>
                )}
              </div>
            );
          })}

          {/* Streaming indicator */}
          {streaming && (
            <div className="card animate-fade-in" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-muted)" }}>
              <Loader size={18} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
              <span style={{ fontSize: 13 }}>Agent is thinking...</span>
            </div>
          )}

          {/* Awaiting Confirmation */}
          {awaitingConfirm && !launched && (
            <div className="card animate-fade-in" style={{
              border: "1px solid rgba(79,142,247,0.4)",
              background: "linear-gradient(135deg, rgba(79,142,247,0.08) 0%, rgba(168,85,247,0.08) 100%)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Rocket size={18} style={{ color: "var(--accent-blue)" }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Campaign Ready to Launch</span>
              </div>

              {awaitingConfirm.campaign && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Campaign", value: awaitingConfirm.campaign.name },
                    { label: "Segment", value: awaitingConfirm.campaign.segment_name },
                    { label: "Audience", value: `${awaitingConfirm.campaign.audience_count?.toLocaleString()} customers` },
                    { label: "Channel", value: `${CHANNEL_ICONS[awaitingConfirm.campaign.channel]} ${awaitingConfirm.campaign.channel}` },
                  ].map(item => (
                    <div key={item.label} style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: 8, marginBottom: 16, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {awaitingConfirm.campaign?.message?.replace("{name}", "Priya")}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-primary" onClick={handleConfirm} disabled={confirming} style={{ flex: 1, justifyContent: "center" }}>
                  {confirming
                    ? <><Loader size={16} className="animate-spin" />Launching...</>
                    : <><Rocket size={16} />Confirm & Launch</>}
                </button>
                <button className="btn-secondary" onClick={reset} disabled={confirming}>Cancel</button>
              </div>
            </div>
          )}

          {/* Launch Success */}
          {launched && (
            <div className="card animate-fade-in" style={{
              border: "1px solid rgba(16,185,129,0.4)",
              background: "rgba(16,185,129,0.08)",
              textAlign: "center",
              padding: 32,
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-green)", marginBottom: 8 }}>
                Campaign Launched!
              </div>
              <div style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
                Sending to {launched.recipient_count?.toLocaleString()} customers. Analytics will update in real-time.
              </div>
              <a href={`/campaigns/${launched.campaign_id}`} className="btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
                <BarChart2 size={16} />View Analytics
              </a>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>
    </AppLayout>
  );
}

// Inline BarChart2 import fix
function BarChart2({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
