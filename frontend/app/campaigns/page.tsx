"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import Link from "next/link";
import { Plus, Megaphone, Play, BarChart2, Calendar } from "lucide-react";

interface Campaign { id: string; name: string; channel: string; status: string; created_at: string; launched_at?: string; segment_id?: string; }

const STATUS_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  draft: { label: "Draft", cls: "badge-gray", dot: "#8b9cbf" },
  launching: { label: "Launching", cls: "badge-orange", dot: "#f59e0b" },
  active: { label: "Active", cls: "badge-blue", dot: "#4f8ef7" },
  completed: { label: "Completed", cls: "badge-green", dot: "#10b981" },
};

const CHANNEL_MAP: Record<string, { icon: string; label: string }> = {
  whatsapp: { icon: "💬", label: "WhatsApp" },
  email: { icon: "📧", label: "Email" },
  sms: { icon: "📱", label: "SMS" },
  rcs: { icon: "✨", label: "RCS" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/campaigns").then(setCampaigns).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="section-header">
          <div>
            <h1 className="section-title">Campaigns</h1>
            <p className="section-subtitle">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/campaigns/new" className="btn-primary" style={{ textDecoration: "none" }}>
            <Plus size={16} /> New Campaign
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 80, color: "var(--text-muted)",
            border: "2px dashed var(--border)", borderRadius: 16,
          }}>
            <Megaphone size={40} style={{ marginBottom: 16, opacity: 0.4 }} />
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No campaigns yet</div>
            <p style={{ marginBottom: 20, fontSize: 14 }}>Create your first campaign to reach your customers.</p>
            <Link href="/campaigns/new" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
              <Plus size={16} /> Create Campaign
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {campaigns.map(c => {
              const s = STATUS_STYLES[c.status] || STATUS_STYLES.draft;
              const ch = CHANNEL_MAP[c.channel] || { icon: "📨", label: c.channel };
              return (
                <div key={c.id} className="card animate-fade-in" style={{ position: "relative" }}>
                  {/* Status dot indicator */}
                  {c.status === "active" && (
                    <div style={{
                      position: "absolute", top: 16, right: 16,
                      width: 8, height: 8, borderRadius: "50%",
                      background: "var(--accent-blue)",
                      boxShadow: "0 0 8px var(--accent-blue)",
                      animation: "pulse-glow 2s infinite",
                    }} />
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <span className={`badge ${s.cls}`} style={{ marginBottom: 8 }}>{s.label}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{c.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                      <span>{ch.icon} {ch.label}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                    <Calendar size={12} style={{ marginTop: 1 }} />
                    {c.launched_at
                      ? `Launched ${new Date(c.launched_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                      : `Created ${new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                    }
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/campaigns/${c.id}`} className="btn-secondary" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}>
                      <BarChart2 size={14} /> Analytics
                    </Link>
                    {c.status === "draft" && (
                      <Link href={`/campaigns/${c.id}`} className="btn-primary" style={{ textDecoration: "none" }}>
                        <Play size={14} /> Launch
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
