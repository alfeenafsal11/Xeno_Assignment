"use client";
import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { Search, Users, MapPin, Star, RefreshCw } from "lucide-react";

interface Customer {
  id: string; name: string; email: string; phone?: string;
  city?: string; loyalty_tier?: string; total_spent?: number; last_order_at?: string;
}

const TIER_CONFIG: Record<string, { cls: string; icon: string }> = {
  platinum: { cls: "badge-purple", icon: "💎" },
  gold: { cls: "badge-orange", icon: "🥇" },
  silver: { cls: "badge-gray", icon: "🥈" },
  bronze: { cls: "badge-red", icon: "🥉" },
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `&search=${encodeURIComponent(search)}` : "";
      const data = await api.get(`/api/customers?skip=${page * LIMIT}&limit=${LIMIT}${q}`);
      setCustomers(data.items);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="section-header">
          <div>
            <h1 className="section-title">Customers</h1>
            <p className="section-subtitle">
              {loading ? "Loading..." : `${total.toLocaleString()} customers in database`}
            </p>
          </div>
          <button className="btn-secondary" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 20, maxWidth: 400 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input"
            placeholder="Search by name, email, or city..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            style={{ paddingLeft: 38 }}
          />
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading && customers.length === 0 ? (
            <div style={{ padding: 24 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 16, marginBottom: 14, alignItems: "center" }}>
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                  <div className="skeleton" style={{ flex: 1, height: 16 }} />
                  <div className="skeleton" style={{ width: 120, height: 16 }} />
                  <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 999 }} />
                </div>
              ))}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th><Users size={12} style={{ display: "inline", marginRight: 6 }} />Customer</th>
                  <th>Contact</th>
                  <th><MapPin size={12} style={{ display: "inline", marginRight: 6 }} />City</th>
                  <th><Star size={12} style={{ display: "inline", marginRight: 6 }} />Tier</th>
                  <th>Total Spent</th>
                  <th>Last Order</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  const tier = TIER_CONFIG[c.loyalty_tier ?? "bronze"] || TIER_CONFIG.bronze;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: "50%",
                            background: "var(--gradient-primary)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, fontWeight: 700, color: "white",
                            flexShrink: 0,
                          }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{c.email}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{c.city || "—"}</td>
                      <td>
                        <span className={`badge ${tier.cls}`}>
                          {tier.icon} {c.loyalty_tier}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        ₹{(c.total_spent ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {c.last_order_at
                          ? new Date(c.last_order_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div style={{
              padding: "14px 20px", borderTop: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total.toLocaleString()}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: "6px 14px" }}>
                  Previous
                </button>
                <button className="btn-secondary" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)} style={{ padding: "6px 14px" }}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
