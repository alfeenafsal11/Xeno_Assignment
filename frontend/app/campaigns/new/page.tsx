"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Sparkles, Loader, Check, ChevronRight, ChevronLeft, Eye, Send } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

interface Segment { id: string; name: string; filter_rules: object; created_by_ai: boolean; }

const STEPS = [
  { n: 1, label: "Segment" },
  { n: 2, label: "Audience" },
  { n: 3, label: "Message" },
  { n: 4, label: "Channel" },
  { n: 5, label: "Preview" },
];

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", icon: "💬", desc: "High open rate. Best for personal outreach." },
  { id: "email", label: "Email", icon: "📧", desc: "Detailed content, promotions, newsletters." },
  { id: "sms", label: "SMS", icon: "📱", desc: "Highest deliverability. No internet needed." },
  { id: "rcs", label: "RCS", icon: "✨", desc: "Rich media. Growing in India." },
];

const GOALS = ["win-back", "promotion", "new-launch", "loyalty", "reactivation"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSeg, setSelectedSeg] = useState<Segment | null>(null);
  const [preview, setPreview] = useState<{ count: number; sample: {name:string}[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [goal, setGoal] = useState("win-back");
  const [aiMsgLoading, setAiMsgLoading] = useState(false);
  const [aiChannelRec, setAiChannelRec] = useState<{recommended:string;reasoning:string} | null>(null);
  const [aiChannelLoading, setAiChannelLoading] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => { api.get("/api/segments").then(setSegments); }, []);

  const handleSelectSeg = async (seg: Segment) => {
    setSelectedSeg(seg);
    setPreviewLoading(true);
    try {
      const p = await api.get(`/api/segments/${seg.id}/preview`);
      setPreview(p);
    } catch { setPreview(null); }
    finally { setPreviewLoading(false); }
  };

  const handleAiMessage = async () => {
    if (!selectedSeg) return;
    setAiMsgLoading(true);
    try {
      const res = await api.post("/api/ai/message", {
        segment_description: selectedSeg.name,
        goal,
        channel,
      });
      setMessage(res.message || "");
      setSubject(res.subject || "");
    } catch (e: unknown) {
      alert((e as Error).message || "AI generation failed");
    } finally { setAiMsgLoading(false); }
  };

  const handleAiChannel = async () => {
    if (!selectedSeg || !preview) return;
    setAiChannelLoading(true);
    try {
      const res = await api.post("/api/ai/channel", {
        segment_description: selectedSeg.name,
        goal,
        audience_size: preview.count,
      });
      setAiChannelRec(res);
      setChannel(res.recommended);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally { setAiChannelLoading(false); }
  };

  const handleLaunch = async () => {
    if (!selectedSeg || !message || !campaignName) return;
    setLaunching(true);
    try {
      const camp = await api.post("/api/campaigns", {
        name: campaignName,
        segment_id: selectedSeg.id,
        message,
        channel,
      });
      await api.post(`/api/campaigns/${camp.id}/launch`, {});
      router.push(`/campaigns/${camp.id}`);
    } catch (e: unknown) {
      alert((e as Error).message || "Launch failed");
      setLaunching(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in" style={{ maxWidth: 740 }}>
        <h1 className="section-title" style={{ marginBottom: 28 }}>New Campaign</h1>

        {/* Step indicator */}
        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <>
              <div key={s.n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div className={`step-dot ${step === s.n ? "active" : step > s.n ? "done" : "pending"}`}>
                  {step > s.n ? <Check size={12} /> : s.n}
                </div>
                <span style={{ fontSize: 10, color: step === s.n ? "var(--accent-blue)" : "var(--text-muted)", fontWeight: step === s.n ? 600 : 400 }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${step > s.n ? "active" : ""}`} key={`line-${i}`} style={{ marginBottom: 18 }} />}
            </>
          ))}
        </div>

        {/* Step 1: Select Segment */}
        {step === 1 && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: 4 }}>Select Audience Segment</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Choose who to send this campaign to.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {segments.map(seg => (
                <div key={seg.id}
                  onClick={() => handleSelectSeg(seg)}
                  style={{
                    padding: 16, borderRadius: 10,
                    border: `1px solid ${selectedSeg?.id === seg.id ? "var(--accent-blue)" : "var(--border)"}`,
                    background: selectedSeg?.id === seg.id ? "rgba(79,142,247,0.08)" : "var(--bg-secondary)",
                    cursor: "pointer", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: selectedSeg?.id === seg.id ? "var(--gradient-primary)" : "var(--bg-hover)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {selectedSeg?.id === seg.id ? <Check size={16} color="white" /> : "🎯"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{seg.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {seg.created_by_ai ? "✨ AI-generated" : "Manual segment"} · {(seg.filter_rules as {conditions:unknown[]}).conditions?.length} conditions
                    </div>
                  </div>
                  {previewLoading && selectedSeg?.id === seg.id && <Loader size={16} className="animate-spin" style={{ color: "var(--accent-blue)" }} />}
                  {preview && selectedSeg?.id === seg.id && (
                    <span style={{ fontWeight: 700, color: "var(--accent-green)" }}>{preview.count.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>

            {segments.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                No segments yet. <a href="/segments" style={{ color: "var(--accent-blue)" }}>Create one first →</a>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-primary" disabled={!selectedSeg} onClick={() => setStep(2)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Audience Preview */}
        {step === 2 && selectedSeg && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: 4 }}>Review Audience</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Confirm your target audience before writing the message.</p>

            <div style={{
              padding: 20, background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, marginBottom: 20,
            }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-green)" }}>
                {preview?.count.toLocaleString() ?? "—"}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>customers will receive this campaign</div>
            </div>

            {preview?.sample && preview.sample.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="label">Sample Recipients</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {preview.sample.map((c, i) => (
                    <div key={i} style={{
                      padding: "6px 14px", borderRadius: 20,
                      background: "var(--bg-hover)", border: "1px solid var(--border)",
                      fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: "var(--gradient-primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "white",
                      }}>
                        {(c.name || "?").charAt(0)}
                      </div>
                      {c.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button className="btn-secondary" onClick={() => setStep(1)}><ChevronLeft size={16} />Back</button>
              <button className="btn-primary" onClick={() => setStep(3)}>Next <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* Step 3: Message */}
        {step === 3 && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: 4 }}>Write Campaign Message</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Use {"{name}"} as a placeholder for the customer's name.</p>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Campaign Name</label>
              <input className="input" placeholder="e.g. Summer Win-Back Campaign" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Campaign Goal</label>
              <select className="input" value={goal} onChange={e => setGoal(e.target.value)}>
                {GOALS.map(g => <option key={g} value={g}>{g.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>

            {channel === "email" && (
              <div style={{ marginBottom: 16 }}>
                <label className="label">Email Subject</label>
                <input className="input" placeholder="Subject line..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label className="label" style={{ margin: 0 }}>Message Body</label>
                <button className="btn-ghost" onClick={handleAiMessage} disabled={aiMsgLoading} style={{ fontSize: 12, color: "var(--accent-purple)" }}>
                  {aiMsgLoading ? <><Loader size={12} className="animate-spin" />Generating...</> : <><Sparkles size={12} />Generate with AI</>}
                </button>
              </div>
              <textarea className="input" style={{ minHeight: 120 }}
                placeholder="Write your message here. Use {name} for personalization."
                value={message} onChange={e => setMessage(e.target.value)} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {message.length} characters · {channel === "sms" ? "160 char limit for SMS" : channel === "whatsapp" ? "300 char recommended for WhatsApp" : "No limit for Email"}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="btn-secondary" onClick={() => setStep(2)}><ChevronLeft size={16} />Back</button>
              <button className="btn-primary" disabled={!message || !campaignName} onClick={() => setStep(4)}>Next <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* Step 4: Channel */}
        {step === 4 && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: 4 }}>Select Channel</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>Choose how to reach your customers.</p>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button className="btn-ghost" onClick={handleAiChannel} disabled={aiChannelLoading} style={{ fontSize: 12, color: "var(--accent-purple)" }}>
                {aiChannelLoading ? <><Loader size={12} className="animate-spin" />Analyzing...</> : <><Sparkles size={12} />AI Recommendation</>}
              </button>
            </div>

            {aiChannelRec && (
              <div style={{
                padding: 14, background: "rgba(168,85,247,0.08)",
                border: "1px solid rgba(168,85,247,0.25)", borderRadius: 10, marginBottom: 16, fontSize: 13,
              }}>
                <div style={{ fontWeight: 600, color: "var(--accent-purple)", marginBottom: 4 }}>
                  ✨ AI recommends: {aiChannelRec.recommended}
                </div>
                <div style={{ color: "var(--text-secondary)" }}>{aiChannelRec.reasoning}</div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {CHANNELS.map(ch => (
                <div key={ch.id} onClick={() => setChannel(ch.id)}
                  style={{
                    padding: 16, borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${channel === ch.id ? "var(--accent-blue)" : "var(--border)"}`,
                    background: channel === ch.id ? "rgba(79,142,247,0.08)" : "var(--bg-secondary)",
                    transition: "all 0.15s",
                  }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{ch.icon}</div>
                  <div style={{ fontWeight: 600 }}>{ch.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{ch.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button className="btn-secondary" onClick={() => setStep(3)}><ChevronLeft size={16} />Back</button>
              <button className="btn-primary" onClick={() => setStep(5)}>Preview <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* Step 5: Preview + Launch */}
        {step === 5 && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: 20 }}>Campaign Preview</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Campaign Name", value: campaignName },
                { label: "Segment", value: selectedSeg?.name },
                { label: "Audience Size", value: preview?.count.toLocaleString() },
                { label: "Channel", value: `${CHANNELS.find(c=>c.id===channel)?.icon} ${channel}` },
                { label: "Goal", value: goal },
              ].map(item => (
                <div key={item.label} style={{ padding: 14, background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontWeight: 600 }}>{item.value || "—"}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div className="label">Message Preview</div>
              <div style={{
                padding: 16, background: "var(--bg-secondary)", borderRadius: 10,
                border: "1px solid var(--border)", fontSize: 14, lineHeight: 1.8,
                whiteSpace: "pre-wrap",
              }}>
                {message.replace("{name}", "Priya")}
              </div>
              {channel === "email" && subject && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Subject: <strong>{subject}</strong>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="btn-secondary" onClick={() => setStep(4)}><ChevronLeft size={16} />Back</button>
              <button className="btn-primary" onClick={handleLaunch} disabled={launching} style={{ minWidth: 140, justifyContent: "center" }}>
                {launching ? <><Loader size={16} className="animate-spin" />Launching...</> : <><Send size={16} />Launch Campaign</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
