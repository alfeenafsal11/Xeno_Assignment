"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { Users, Megaphone, TrendingUp, Mail, ArrowRight, Activity, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";

interface Analytics { total_campaigns: number; total_sent: number; avg_delivery_rate: number; avg_open_rate: number; }
interface Campaign { id: string; name: string; status: string; channel: string; created_at: string; }
interface CustomerData { total: number; }

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "badge-gray" },
  launching: { label: "Launching", cls: "badge-orange" },
  active: { label: "Active", cls: "badge-blue" },
  completed: { label: "Completed", cls: "badge-green" },
};

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬", email: "📧", sms: "📱", rcs: "✨",
};

function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${color}20`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/analytics/campaigns"),
      api.get("/api/campaigns"),
      api.get("/api/customers?limit=1"),
    ]).then(([a, c, cu]) => {
      setAnalytics(a);
      setCampaigns(c.slice(0, 6));
      setCustomerCount(cu.total);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="section-header" style={{ marginBottom: 32 }}>
          <div>
            <h1 className="section-title" style={{ fontSize: 26 }}>
              Good morning 👋
            </h1>
            <p className="section-subtitle">Here's what's happening with your campaigns today</p>
          </div>
          <Link href="/campaigns/new" className="btn-primary" style={{ textDecoration: "none" }}>
            <Megaphone size={16} />
            New Campaign
          </Link>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          <KPICard
            icon={<Users size={20} />}
            label="Total Customers"
            value={loading ? "—" : customerCount.toLocaleString()}
            sub="Across all segments"
            color="var(--accent-blue)"
          />
          <KPICard
            icon={<Megaphone size={20} />}
            label="Total Campaigns"
            value={loading ? "—" : String(analytics?.total_campaigns ?? 0)}
            sub="Lifetime"
            color="var(--accent-purple)"
          />
          <KPICard
            icon={<TrendingUp size={20} />}
            label="Avg Delivery Rate"
            value={loading ? "—" : `${((analytics?.avg_delivery_rate ?? 0) * 100).toFixed(1)}%`}
            sub="Across all campaigns"
            color="var(--accent-green)"
          />
          <KPICard
            icon={<Mail size={20} />}
            label="Avg Open Rate"
            value={loading ? "—" : `${((analytics?.avg_open_rate ?? 0) * 100).toFixed(1)}%`}
            sub="Industry avg: 21%"
            color="var(--accent-orange)"
          />
        </div>

        {/* Recent Campaigns + Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
          {/* Campaigns table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Recent Campaigns</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Latest campaign activity</div>
              </div>
              <Link href="/campaigns" style={{ textDecoration: "none" }}>
                <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  View all <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            {loading ? (
              <div style={{ padding: 20 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div className="skeleton" style={{ width: 40, height: 20 }} />
                    <div className="skeleton" style={{ flex: 1, height: 20 }} />
                    <div className="skeleton" style={{ width: 80, height: 20 }} />
                  </div>
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                No campaigns yet. <Link href="/campaigns/new" style={{ color: "var(--accent-blue)" }}>Create one →</Link>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => {
                    const s = STATUS_CONFIG[c.status] || { label: c.status, cls: "badge-gray" };
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/campaigns/${c.id}`} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>
                            {c.name}
                          </Link>
                        </td>
                        <td>{CHANNEL_ICONS[c.channel]} {c.channel}</td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card" style={{ background: "linear-gradient(135deg, rgba(79,142,247,0.15) 0%, rgba(168,85,247,0.15) 100%)", border: "1px solid rgba(79,142,247,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Activity size={20} style={{ color: "var(--accent-blue)" }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>AI Agent</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                Describe your marketing goal and let AI build the full campaign for you.
              </p>
              <Link href="/agent" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
                Launch AI Agent →
              </Link>
            </div>

            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Quick Actions</div>
              {[
                { href: "/segments", icon: "🎯", label: "Create Segment", sub: "Build audience" },
                { href: "/campaigns/new", icon: "📣", label: "New Campaign", sub: "Draft & launch" },
                { href: "/customers", icon: "👥", label: "View Customers", sub: "Browse data" },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 0", borderBottom: "1px solid var(--border)",
                    transition: "opacity 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.sub}</div>
                    </div>
                    <ArrowRight size={14} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />
                  </div>
                </Link>
              ))}
            </div>

            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Delivery Stats</div>
              {loading ? (
                <div className="skeleton" style={{ height: 80 }} />
              ) : (
                <>
                  {[
                    { icon: <CheckCircle size={14} />, label: "Delivered", val: analytics?.avg_delivery_rate ?? 0, color: "var(--accent-green)" },
                    { icon: <Mail size={14} />, label: "Open Rate", val: analytics?.avg_open_rate ?? 0, color: "var(--accent-blue)" },
                  ].map(item => (
                    <div key={item.label} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                        <span style={{ color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ color: item.color }}>{item.icon}</span>{item.label}
                        </span>
                        <span style={{ fontWeight: 600 }}>{(item.val * 100).toFixed(1)}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${item.val * 100}%`, background: item.color }} />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
