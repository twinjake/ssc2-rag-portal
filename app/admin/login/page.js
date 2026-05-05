"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Invalid email or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#121212",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#eaeaea" }}>Admin Access</h1>
          <p style={{ margin: "6px 0 0", color: "#888", fontSize: 14 }}>Ask Dr. Spencer — Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#242424",
                border: "1px solid #333",
                borderRadius: 8,
                color: "#eaeaea",
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#242424",
                border: "1px solid #333",
                borderRadius: 8,
                color: "#eaeaea",
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#2b1f1f",
              border: "1px solid #4a2a2a",
              color: "#FF8A80",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#37474F" : "#1976D2",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
