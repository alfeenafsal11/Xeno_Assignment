"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { Plus, Target, Eye, Sparkles, Sliders, Trash2, Loader, Check } from "lucide-react";

interface Condition { field: string; op: string; value: string | number | string[]; }
interface FilterRules { operator: "AND" | "OR"; conditions: Condition[]; }
interface Segment { id: string; name: string; filter_rules: FilterRules; created_by_ai: boolean; nl_query?: string; created_at: string; }

const FIELDS = [
  { value: "total_spent", label: "Total Spent (₹)" },
  { value: "days_since_last_order", label: "Days Since Last Order" },
  { value: "loyalty_tier", label: "Loyalty Tier" },
  { value: "city", label: "City" },
  { value: "created_days_ago", label: "Days Since Joined" },
];

const OPS: Record<string, { label: string; type: "number" | "string" | "tier" | "city" }[]> = {
  total_spent: [
    { label: "Greater than", type: "number" }, { label: "Less than", type: "number" },
    { label: "Greater or equal", type: "number" }, { label: "Less or equal", type: "number" },
  ],
  days_since_last_order: [
    { label: "Greater than", type: "number" }, { label: "Less than", type: "number" },
    { label: "Greater or equal", type: "number" }, { label: "Less or equal", type: "number" },
  ],
  loyalty_tier: [
    { label: "Is one of", type: "tier" }, { label: "Is not one of", type: "tier" },
  ],
  city: [
    { label: "Equals", type: "city" }, { label: "Not equals", type: "city" },
  ],
  created_days_ago: [
    { label: "Greater than", type: "number" }, { label: "Less than", type: "number" },
    { label: "Less or equal", type: "number" },
  ],
};

const OP_VALUES: Record<string, string> = {
  "Greater than": "gt", "Less than": "lt", "Greater or equal": "gte", "Less or equal": "lte",
  "Equals": "eq", "Not equals": "neq", "Is one of": "in", "Is not one of": "not_in",
};

const TIERS = ["bronze", "silver", "gold", "platinum"];

function ConditionRow({
  cond, index, onChange, onRemove
}: {
  cond: Condition; index: number; onChange: (c: Condition) => void; onRemove: () => void;
}) {
  const fieldOps = OPS[cond.field] || [];
  const currentOp = Object.entries(OP_VALUES).find(([, v]) => v === cond.op)?.[0] || "";
  const inputType = fieldOps.find(o => o.label === currentOp)?.type || "string";

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
      <select className="input" style={{ flex: "0 0 200px" }} value={cond.field}
        onChange={e => onChange({ ...cond, field: e.target.value, op: "", value: "" })}>
        {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      <select className="input" style={{ flex: "0 0 180px" }} value={currentOp}
        onChange={e => onChange({ ...cond, op: OP_VALUES[e.target.value] || "" })}>
        <option value="">Select operator</option>
        {(OPS[cond.field] || []).map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
      </select>

      {inputType === "tier" ? (
        <div style={{ display: "flex", gap: 6, flex: 1 }}>
          {TIERS.map(tier => {
            const selected = Array.isArray(cond.value) ? cond.value.includes(tier) : false;
            return (
              <button key={tier} type="button"
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${selected ? "var(--accent-blue)" : "var(--border)"}`,
                  background: selected ? "rgba(79,142,247,0.15)" : "transparent",
                  color: selected ? "var(--accent-blue)" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
                onClick={() => {
                  const arr = Array.isArray(cond.value) ? [...cond.value as string[]] : [];
                  const i = arr.indexOf(tier);
                  if (i === -1) arr.push(tier); else arr.splice(i, 1);
                  onChange({ ...cond, value: arr });
                }}>
                {tier}
              </button>
            );
          })}
        </div>
      ) : (
        <input className="input" style={{ flex: 1 }}
          type={inputType === "number" ? "number" : "text"}
          placeholder={inputType === "number" ? "Enter value" : "Enter city name"}
          value={Array.isArray(cond.value) ? "" : String(cond.value)}
          onChange={e => onChange({ ...cond, value: inputType === "number" ? Number(e.target.value) : e.target.value })}
        />
      )}

      <button className="btn-ghost" onClick={onRemove} style={{ color: "var(--accent-red)", padding: "6px" }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"list" | "builder" | "ai">("list");
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [name, setName] = useState("");
  const [filterRules, setFilterRules] = useState<FilterRules>({ operator: "AND", conditions: [] });
  const [preview, setPreview] = useState<{ count: number; sample: unknown[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/api/segments").then(setSegments).finally(() => setLoading(false));
  }, []);

  const addCondition = () => {
    setFilterRules(r => ({
      ...r,
      conditions: [...r.conditions, { field: "total_spent", op: "gt", value: "" }],
    }));
  };

  const updateCondition = (i: number, c: Condition) => {
    setFilterRules(r => {
      const conds = [...r.conditions];
      conds[i] = c;
      return { ...r, conditions: conds };
    });
  };

  const removeCondition = (i: number) => {
    setFilterRules(r => ({ ...r, conditions: r.conditions.filter((_, j) => j !== i) }));
  };

  const handleAiGenerate = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const result = await api.post("/api/ai/segment", { query: aiQuery });
      setFilterRules(result.filter_rules);
      setName(result.suggested_name || "AI Generated Segment");
      setTab("builder");
    } catch (e: unknown) {
      alert((e as Error).message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handlePreview = async () => {
    if (filterRules.conditions.length === 0) return;
    setPreviewLoading(true);
    try {
      // Create temp segment for preview, or use direct evaluate
      const tempSeg = await api.post("/api/segments", {
        name: name || "Preview",
        filter_rules: filterRules,
        created_by_ai: false,
      });
      const prev = await api.get(`/api/segments/${tempSeg.id}/preview`);
      setPreview(prev);
    } catch (e: unknown) {
      alert((e as Error).message || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || filterRules.conditions.length === 0) return;
    setSaving(true);
    try {
      await api.post("/api/segments", { name, filter_rules: filterRules, created_by_ai: false });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setTab("list");
        setFilterRules({ operator: "AND", conditions: [] });
        setName("");
        setPreview(null);
        api.get("/api/segments").then(setSegments);
      }, 1200);
    } catch (e: unknown) {
      alert((e as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="section-header">
          <div>
            <h1 className="section-title">Audience Segments</h1>
            <p className="section-subtitle">{segments.length} segments defined</p>
          </div>
          <button className="btn-primary" onClick={() => setTab("builder")}>
            <Plus size={16} /> New Segment
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
          {[
            { id: "list", label: "All Segments", icon: <Target size={14} /> },
            { id: "builder", label: "Rule Builder", icon: <Sliders size={14} /> },
            { id: "ai", label: "✨ Ask AI", icon: <Sparkles size={14} /> },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
                background: "transparent", border: "none", cursor: "pointer",
                color: tab === t.id ? "var(--accent-blue)" : "var(--text-secondary)",
                borderBottom: tab === t.id ? "2px solid var(--accent-blue)" : "2px solid transparent",
                fontWeight: tab === t.id ? 600 : 400, fontSize: 14, marginBottom: -1,
                transition: "color 0.15s",
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Segments list */}
        {tab === "list" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />
              ))
            ) : segments.map(seg => (
              <div key={seg.id} className="card animate-fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{seg.name}</div>
                  {seg.created_by_ai && (
                    <span className="badge badge-purple"><Sparkles size={10} /> AI</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  {seg.filter_rules.conditions.length} condition{seg.filter_rules.conditions.length !== 1 ? "s" : ""} · {seg.filter_rules.operator}
                </div>
                {seg.nl_query && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", marginBottom: 12 }}>
                    "{seg.nl_query}"
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(seg.created_at).toLocaleDateString("en-IN")}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <SegmentPreviewButton segmentId={seg.id} />
                  </div>
                </div>
              </div>
            ))}
            {!loading && segments.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", padding: 60 }}>
                No segments yet. Create one using the Rule Builder or AI.
              </div>
            )}
          </div>
        )}

        {/* Rule Builder */}
        {tab === "builder" && (
          <div className="card" style={{ maxWidth: 800 }}>
            <h2 style={{ fontWeight: 700, marginBottom: 20 }}>Rule Builder</h2>

            <div style={{ marginBottom: 20 }}>
              <label className="label">Segment Name</label>
              <input className="input" placeholder="e.g. High-Value Churned Customers"
                value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <label className="label" style={{ margin: 0 }}>Conditions — match</label>
                <button
                  type="button"
                  style={{
                    padding: "3px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: "1px solid var(--accent-blue)", background: "rgba(79,142,247,0.1)",
                    color: "var(--accent-blue)", transition: "all 0.15s",
                  }}
                  onClick={() => setFilterRules(r => ({ ...r, operator: r.operator === "AND" ? "OR" : "AND" }))}>
                  {filterRules.operator}
                </button>
                <label className="label" style={{ margin: 0 }}>of the following:</label>
              </div>

              {filterRules.conditions.map((c, i) => (
                <ConditionRow key={i} cond={c} index={i}
                  onChange={c => updateCondition(i, c)}
                  onRemove={() => removeCondition(i)} />
              ))}

              <button className="btn-secondary" onClick={addCondition} style={{ marginTop: 4 }}>
                <Plus size={14} /> Add Condition
              </button>
            </div>

            {/* Preview */}
            {preview && (
              <div style={{
                padding: 16, background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, color: "var(--accent-green)", fontSize: 24, marginBottom: 4 }}>
                  {preview.count.toLocaleString()} customers
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>match this segment</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary" onClick={handlePreview} disabled={previewLoading || filterRules.conditions.length === 0}>
                {previewLoading ? <><Loader size={14} className="animate-spin" />Previewing...</> : <><Eye size={14} />Preview Audience</>}
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !name || filterRules.conditions.length === 0}>
                {saved ? <><Check size={14} />Saved!</> : saving ? <><Loader size={14} className="animate-spin" />Saving...</> : "Save Segment"}
              </button>
            </div>
          </div>
        )}

        {/* AI Tab */}
        {tab === "ai" && (
          <div className="card" style={{ maxWidth: 700 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Sparkles size={20} style={{ color: "var(--accent-purple)" }} />
              <h2 style={{ fontWeight: 700 }}>Ask AI to Build Your Segment</h2>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: 13 }}>
              Describe your audience in plain language. The AI will convert it to filter rules.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Describe your audience</label>
              <textarea className="input" style={{ minHeight: 100 }}
                placeholder="e.g. 'Customers who spent over INR 10,000 but haven't bought in 90 days and are gold or platinum tier'"
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {[
                "High value customers inactive for 60 days",
                "New customers from Mumbai and Delhi",
                "Platinum tier customers",
                "Customers who spent under 3000",
              ].map(q => (
                <button key={q} className="btn-ghost"
                  style={{ border: "1px solid var(--border)", fontSize: 12 }}
                  onClick={() => setAiQuery(q)}>
                  {q}
                </button>
              ))}
            </div>

            <button className="btn-primary" onClick={handleAiGenerate} disabled={aiLoading || !aiQuery.trim()}>
              {aiLoading
                ? <><Loader size={16} className="animate-spin" />Generating...</>
                : <><Sparkles size={16} />Generate Segment Rules</>}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SegmentPreviewButton({ segmentId }: { segmentId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const preview = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/segments/${segmentId}/preview`);
      setCount(data.count);
    } catch { setCount(0); }
    finally { setLoading(false); }
  };

  if (count !== null) {
    return <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}>{count.toLocaleString()} customers</span>;
  }

  return (
    <button className="btn-secondary" onClick={preview} disabled={loading} style={{ padding: "5px 12px", fontSize: 12 }}>
      {loading ? <Loader size={12} className="animate-spin" /> : <><Eye size={12} />Preview</>}
    </button>
  );
}
