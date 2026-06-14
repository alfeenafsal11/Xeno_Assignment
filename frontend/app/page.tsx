"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, Loader } from "lucide-react";
import { apiBase } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@xeno.ai");
  const [password, setPassword] = useState("demo123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (localStorage.getItem("xeno_token")) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem("xeno_token", data.access_token);
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-primary)",
      padding: 24,
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed",
        top: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        width: 600,
        height: 400,
        background: "radial-gradient(ellipse, rgba(79, 142, 247, 0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="animate-fade-in" style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "var(--gradient-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 0 40px rgba(79, 142, 247, 0.3)",
          }}>
            <Zap size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
            Xeno <span className="gradient-text">AI CRM</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 15 }}>
            AI Marketing Copilot for D2C Brands
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: "var(--text-primary)" }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{
                  position: "absolute", left: 12, top: "50%",
                  transform: "translateY(-50%)", color: "var(--text-muted)"
                }} />
                <input
                  id="login-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: 38 }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="label">Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{
                  position: "absolute", left: 12, top: "50%",
                  transform: "translateY(-50%)", color: "var(--text-muted)"
                }} />
                <input
                  id="login-password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: 38 }}
                  required
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 8, padding: "10px 14px",
                color: "#ef4444", fontSize: 13, marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button id="login-submit" type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? <><Loader size={16} className="animate-spin" /> Signing in...</> : "Sign In"}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div style={{
            marginTop: 20,
            padding: "12px 14px",
            background: "rgba(79, 142, 247, 0.08)",
            borderRadius: 8,
            border: "1px solid rgba(79, 142, 247, 0.2)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-blue)", marginBottom: 6 }}>
              Demo Credentials
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Email: <strong>demo@xeno.ai</strong><br />
              Password: <strong>demo123</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
