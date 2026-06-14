"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Megaphone, Bot, LogOut, Zap
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/segments", label: "Segments", icon: Target },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/agent", label: "AI Agent", icon: Bot },
];

export default function Sidebar() {
  const path = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("xeno_token");
    window.location.href = "/";
  };

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      background: "var(--bg-secondary)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 0",
      position: "fixed",
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: "0 20px 24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--gradient-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>Xeno CRM</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>AI Marketing Copilot</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 4,
                color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                background: active ? "rgba(79, 142, 247, 0.1)" : "transparent",
                textDecoration: "none",
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                transition: "all 0.15s",
                borderLeft: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
        <div style={{ padding: "8px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Signed in as</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>demo@xeno.ai</div>
        </div>
        <button onClick={handleLogout} className="btn-ghost" style={{ width: "100%", justifyContent: "flex-start" }}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
