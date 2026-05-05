"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";

const PLAN_LABELS = {
  free_trial: "Free Trial",
  paid: "Paid",
  comped: "Comped (Free Unlimited)",
  admin: "Admin",
};

const PLAN_COLORS = {
  free_trial: "#888",
  paid: "#22c55e",
  comped: "#0ea5e9",
  admin: "#f59e0b",
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editPlan, setEditPlan] = useState("");
  const [editReset, setEditReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [invitePlan, setInvitePlan] = useState("free_trial");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users?limit=200");
      if (res.status === 403) {
        setError("Access denied. Admin only.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
    );
  });

  async function savePlan(userId) {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: editPlan, resetCount: editReset }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaveMsg("Saved!");
      setEditingId(null);
      await loadUsers();
    } catch (e) {
      setSaveMsg("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          firstName: inviteFirst,
          lastName: inviteLast,
          plan: invitePlan,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInviteMsg(`Invitation sent to ${inviteEmail}`);
      setInviteEmail(""); setInviteFirst(""); setInviteLast(""); setInvitePlan("free_trial");
      await loadUsers();
    } catch (e) {
      setInviteMsg("Error: " + e.message);
    } finally {
      setInviting(false);
    }
  }

  const s = {
    page: { minHeight: "100vh", background: "#111", color: "#eaeaea", fontFamily: "system-ui, sans-serif", padding: "0 0 60px" },
    topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid #222", background: "#181818" },
    title: { margin: 0, fontSize: 20, fontWeight: 700 },
    section: { maxWidth: 1100, margin: "32px auto", padding: "0 20px" },
    card: { background: "#181818", border: "1px solid #2a2a2a", borderRadius: 12, padding: "24px", marginBottom: 28 },
    h2: { margin: "0 0 18px", fontSize: 16, fontWeight: 600, color: "#ccc" },
    input: { background: "#222", border: "1px solid #333", borderRadius: 8, color: "#eaeaea", padding: "8px 12px", fontSize: 14, outline: "none", width: "100%" },
    btn: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #2a2a2a", color: "#888", fontWeight: 600 },
    td: { padding: "10px 12px", borderBottom: "1px solid #1e1e1e", verticalAlign: "middle" },
    badge: (plan) => ({
      display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, background: PLAN_COLORS[plan] + "22", color: PLAN_COLORS[plan],
      border: `1px solid ${PLAN_COLORS[plan]}44`,
    }),
    select: { background: "#222", border: "1px solid #333", borderRadius: 6, color: "#eaeaea", padding: "6px 10px", fontSize: 13 },
  };

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <h1 style={s.title}>Admin Dashboard — Ask Dr. Spencer</h1>
        <UserButton />
      </div>

      <div style={s.section}>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Users", value: users.length },
            { label: "Paid", value: users.filter(u => u.plan === "paid").length },
            { label: "Comped", value: users.filter(u => u.plan === "comped").length },
            { label: "Free Trial", value: users.filter(u => u.plan === "free_trial").length },
            { label: "Total Chats", value: users.reduce((a, u) => a + (u.chatCount || 0), 0) },
          ].map((stat) => (
            <div key={stat.label} style={{ ...s.card, padding: "16px 20px", marginBottom: 0, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Invite new user */}
        <div style={s.card}>
          <h2 style={s.h2}>Invite / Add User</h2>
          <form onSubmit={sendInvite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Email *</label>
              <input style={s.input} type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>First Name</label>
              <input style={s.input} value={inviteFirst} onChange={e => setInviteFirst(e.target.value)} placeholder="Jane" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Last Name</label>
              <input style={s.input} value={inviteLast} onChange={e => setInviteLast(e.target.value)} placeholder="Smith" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Plan</label>
              <select style={{ ...s.select, width: "100%" }} value={invitePlan} onChange={e => setInvitePlan(e.target.value)}>
                <option value="free_trial">Free Trial (3 chats)</option>
                <option value="paid">Paid</option>
                <option value="comped">Comped (Free Unlimited)</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} style={{ ...s.btn, background: "#0ea5e9", color: "#fff", height: 38 }}>
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>
          {inviteMsg && <p style={{ marginTop: 10, fontSize: 13, color: inviteMsg.startsWith("Error") ? "#f87171" : "#22c55e" }}>{inviteMsg}</p>}
        </div>

        {/* User list */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ ...s.h2, margin: 0 }}>All Users ({filtered.length})</h2>
            <input
              style={{ ...s.input, width: 240 }}
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {error && <p style={{ color: "#f87171" }}>{error}</p>}
          {loading ? (
            <p style={{ color: "#888" }}>Loading users...</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Plan</th>
                    <th style={s.th}>Chats Used</th>
                    <th style={s.th}>Last Chat</th>
                    <th style={s.th}>Joined</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td style={s.td}>{u.firstName} {u.lastName}</td>
                      <td style={s.td}>{u.email}</td>
                      <td style={s.td}>
                        {editingId === u.id ? (
                          <select style={s.select} value={editPlan} onChange={e => setEditPlan(e.target.value)}>
                            <option value="free_trial">Free Trial</option>
                            <option value="paid">Paid</option>
                            <option value="comped">Comped</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span style={s.badge(u.plan || "free_trial")}>{PLAN_LABELS[u.plan] || u.plan}</span>
                        )}
                      </td>
                      <td style={s.td}>{u.chatCount || 0}</td>
                      <td style={s.td}>{u.lastChat ? new Date(u.lastChat).toLocaleDateString() : "—"}</td>
                      <td style={s.td}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                      <td style={s.td}>
                        {editingId === u.id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
                              <input type="checkbox" checked={editReset} onChange={e => setEditReset(e.target.checked)} />
                              Reset count
                            </label>
                            <button onClick={() => savePlan(u.id)} disabled={saving} style={{ ...s.btn, background: "#22c55e", color: "#000" }}>
                              {saving ? "..." : "Save"}
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ ...s.btn, background: "#333", color: "#eaeaea" }}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(u.id); setEditPlan(u.plan || "free_trial"); setEditReset(false); setSaveMsg(""); }}
                            style={{ ...s.btn, background: "#2a2a2a", color: "#ccc", border: "1px solid #333" }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {saveMsg && <p style={{ marginTop: 10, fontSize: 13, color: saveMsg.startsWith("Error") ? "#f87171" : "#22c55e" }}>{saveMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
