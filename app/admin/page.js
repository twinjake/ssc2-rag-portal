"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, paid: 0, trial: 0, comped: 0 });
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  // Check admin auth on mount
  useEffect(() => {
    fetch("/api/admin/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setAuthed(true);
        } else {
          router.replace("/admin/login");
        }
        setAuthChecked(true);
      })
      .catch(() => {
        router.replace("/admin/login");
        setAuthChecked(true);
      });
  }, [router]);

  // Load users once authed
  useEffect(() => {
    if (!authed) return;
    loadUsers();
  }, [authed]);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const data = await res.json();
      const userList = data.users || [];
      setUsers(userList);

      const total = userList.length;
      const paid = userList.filter((u) => u.plan === "paid").length;
      const comped = userList.filter((u) => u.plan === "comped").length;
      const trial = userList.filter((u) => u.plan === "free_trial" || !u.plan).length;
      setStats({ total, paid, trial, comped });
    } catch {}
    setLoading(false);
  }

  async function updatePlan(userId, newPlan) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: newPlan }),
      });
      if (res.ok) await loadUsers();
    } catch {}
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.name || "").toLowerCase().includes(q)
    );
  });

  const planBadge = (plan) => {
    const map = {
      paid: { label: "Paid", bg: "#1a3a1a", color: "#4caf50", border: "#2e5e2e" },
      comped: { label: "Comped ✓", bg: "#1a2a3a", color: "#64b5f6", border: "#1e4060" },
      free_trial: { label: "Free Trial", bg: "#2a2a1a", color: "#ffc107", border: "#4a3a00" },
    };
    const s = map[plan] || map.free_trial;
    return (
      <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
        {s.label}
      </span>
    );
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "#121212", display: "grid", placeItems: "center", color: "#888", fontFamily: "system-ui, sans-serif" }}>
        Checking access…
      </div>
    );
  }

  if (!authed) return null;

  return (
    <main style={{ minHeight: "100vh", background: "#121212", color: "#eaeaea", fontFamily: "system-ui, -apple-system, sans-serif", padding: "0 0 60px" }}>
      {/* Top bar */}
      <div style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Ask Dr. Spencer — Admin</div>
            <div style={{ fontSize: 12, color: "#888" }}>User Management Dashboard</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadUsers} style={{ padding: "7px 14px", background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 8, color: "#ccc", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            ↻ Refresh
          </button>
          <a href="/" style={{ padding: "7px 14px", background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 8, color: "#ccc", cursor: "pointer", fontSize: 13, textDecoration: "none" }}>
            ← App
          </a>
          <button onClick={handleLogout} style={{ padding: "7px 14px", background: "#2b1f1f", border: "1px solid #4a2a2a", borderRadius: 8, color: "#FF8A80", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Users", value: stats.total, color: "#90CAF9" },
            { label: "Paid", value: stats.paid, color: "#4caf50" },
            { label: "Free Trial", value: stats.trial, color: "#ffc107" },
            { label: "Comped", value: stats.comped, color: "#64b5f6" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", maxWidth: 400, padding: "9px 14px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#eaeaea", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>

        {/* User table */}
        {loading ? (
          <div style={{ color: "#888", padding: 40, textAlign: "center" }}>Loading users…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "#888", padding: 40, textAlign: "center" }}>No users found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                  {["Name", "Email", "Plan", "Chats", "Last Active", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "#888", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #1e1e1e" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#1a1a1a"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "12px 12px", color: "#eaeaea" }}>{u.name || <span style={{ color: "#555" }}>—</span>}</td>
                    <td style={{ padding: "12px 12px", color: "#aaa" }}>{u.email || <span style={{ color: "#555" }}>—</span>}</td>
                    <td style={{ padding: "12px 12px" }}>{planBadge(u.plan || "free_trial")}</td>
                    <td style={{ padding: "12px 12px", color: "#ccc", textAlign: "center" }}>{u.chatCount || 0}</td>
                    <td style={{ padding: "12px 12px", color: "#888", fontSize: 12, whiteSpace: "nowrap" }}>
                      {u.lastChat ? new Date(u.lastChat).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {u.plan !== "paid" && u.plan !== "comped" && (
                          <button onClick={() => updatePlan(u.id, "comped")}
                            style={{ padding: "5px 10px", background: "#1a2a3a", border: "1px solid #1e4060", borderRadius: 6, color: "#64b5f6", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                            Upgrade Free
                          </button>
                        )}
                        {(u.plan === "comped" || u.plan === "paid") && (
                          <button onClick={() => updatePlan(u.id, "free_trial")}
                            style={{ padding: "5px 10px", background: "#2a2a1a", border: "1px solid #4a3a00", borderRadius: 6, color: "#ffc107", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                            Reset Trial
                          </button>
                        )}
                        {u.plan !== "paid" && (
                          <button onClick={() => updatePlan(u.id, "paid")}
                            style={{ padding: "5px 10px", background: "#1a3a1a", border: "1px solid #2e5e2e", borderRadius: 6, color: "#4caf50", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
