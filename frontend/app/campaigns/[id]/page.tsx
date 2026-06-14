"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { BarChart2, ArrowLeft, Play, Loader, RefreshCw, CheckCircle, XCircle, Mail, MousePointer, Send } from "lucide-react";
import Link from "next/link";

interface Campaign { id: string; name: string; channel: string; status: string; message: string; segment_id?: string; created_at: string; launched_at?: string; }
interface Analytics { sent: number; delivered: number; failed: number; opened: number; clicked: number; delivery_rate: number; open_rate: number; click_rate: number; }

const CHANNEL_MAP: Record<string, string> = { whatsapp: "💬", email: "📧", sms: "📱", rcs: "✨" };

function MetricCard({ icon, label, value, rate, color }: { icon: React.ReactNode; label: string; value: number; rate?: number; color: string }) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ color, width: 20, height: 20 }}>{icon}</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
        {value.toLocaleString()}
      </div>
      {rate !== undefined && (
        <>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${rate * 100}%`, background: color }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color, marginTop: 8 }}>{(rate * 100).toFixed(1)}%</div>
        </>
      )}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadAnalytics = async () => {
    try {
      const a = await api.get(`/api/campaigns/${id}/analytics`);
      setAnalytics(a);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    Promise.all([
      api.get(`/api/campaigns/${id}`),
      api.get(`/api/campaigns/${id}/analytics`),
    ]).then(([c, a]) => {
      setCampaign(c);
      setAnalytics(a);
    }).finally(() => setLoading(false));
  }, [id]);

  // 5s polling while campaign is active or launching
  useEffect(() => {
    if (campaign?.status === "active" || campaign?.status === "launching") {
      pollRef.current = setInterval(async () => {
        await loadAnalytics();
        // Also refresh campaign status
        const c = await api.get(`/api/campaigns/${id}`);
        setCampaign(c);
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [campaign?.status, id]);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await api.post(`/api/campaigns/${id}/launch`, {});
      const c = await api.get(`/api/campaigns/${id}`);
      setCampaign(c);
    } catch (e: unknown) {
      alert((e as Error).message || "Launch failed");
    } finally { setLaunching(false); }
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Loader size={32} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
      </div>
    </AppLayout>
  );

  if (!campaign) return (
    <AppLayout>
      <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
        Campaign not found. <Link href="/campaigns" style={{ color: "var(--accent-blue)" }}>Back to campaigns</Link>
      </div>
    </AppLayout>
  );

  const STATUS_BADGE: Record<string, string> = {
    draft: "badge-gray", launching: "badge-orange", active: "badge-blue", completed: "badge-green",
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <Link href="/campaigns" className="btn-ghost"><ArrowLeft size={16} /></Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>{campaign.name}</h1>
              <span className={`badge ${STATUS_BADGE[campaign.status] || "badge-gray"}`}>
                {campaign.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {CHANNEL_MAP[campaign.channel]} {campaign.channel} ·
              {campaign.launched_at
                ? ` Launched ${new Date(campaign.launched_at).toLocaleString("en-IN")}`
                : ` Created ${new Date(campaign.created_at).toLocaleString("en-IN")}`}
            </div>
          </div>

          {campaign.status === "active" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-blue)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-blue)", animation: "pulse-glow 2s infinite" }} />
              Analytics updating...
            </div>
          )}

          <button className="btn-secondary" onClick={loadAnalytics}><RefreshCw size={14} /> Refresh</button>

          {campaign.status === "draft" && (
            <button className="btn-primary" onClick={handleLaunch} disabled={launching}>
              {launching ? <><Loader size={16} className="animate-spin" />Launching...</> : <><Play size={16} />Launch</>}
            </button>
          )}
        </div>

        {/* Analytics Metrics */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          <MetricCard icon={<Send size={16} />} label="Sent" value={analytics?.sent ?? 0} color="var(--text-secondary)" />
          <MetricCard icon={<CheckCircle size={16} />} label="Delivered" value={analytics?.delivered ?? 0} rate={analytics?.delivery_rate} color="var(--accent-green)" />
          <MetricCard icon={<XCircle size={16} />} label="Failed" value={analytics?.failed ?? 0} color="var(--accent-red)" />
          <MetricCard icon={<Mail size={16} />} label="Opened" value={analytics?.opened ?? 0} rate={analytics?.open_rate} color="var(--accent-blue)" />
          <MetricCard icon={<MousePointer size={16} />} label="Clicked" value={analytics?.clicked ?? 0} rate={analytics?.click_rate} color="var(--accent-purple)" />
        </div>

        {/* Campaign details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 16 }}>Message</div>
            <div style={{
              padding: 14, background: "var(--bg-secondary)", borderRadius: 8,
              fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap",
              color: "var(--text-secondary)",
            }}>
              {campaign.message}
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 16 }}>Performance Summary</div>
            {analytics && analytics.sent > 0 ? (
              <div>
                {[
                  { label: "Delivery Rate", val: analytics.delivery_rate, color: "var(--accent-green)" },
                  { label: "Open Rate", val: analytics.open_rate, color: "var(--accent-blue)" },
                  { label: "Click Rate", val: analytics.click_rate, color: "var(--accent-purple)" },
                ].map(item => (
                  <div key={item.label} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                      <span style={{ fontWeight: 700, color: item.color }}>{(item.val * 100).toFixed(1)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${item.val * 100}%`, background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {campaign.status === "draft" ? "Launch campaign to see analytics." : "No data yet. Analytics appear after launch."}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
