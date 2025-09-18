"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";

const BG = "#212121";
const CARD = "#181818";

const STORAGE_KEY = "ssc2_chat_history_v1"; // localStorage key

export default function Home() {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState([]); // {role:"user"|"assistant", content:string}[]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  // Restore last convo from localStorage (up to 10 messages = 5 turns)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-10));
        }
      }
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-10)));
    } catch {}
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const recentHistoryForAPI = useMemo(() => {
    // send last 5 turns (10 messages)
    return messages.slice(-10);
  }, [messages]);

  async function ask(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setError("");
    setLoading(true);

    // Show the user message immediately
    const nextMessages = [...messages, { role: "user", content: q.trim() }];
    setMessages(nextMessages);
    setQ("");

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.trim(),
          history: recentHistoryForAPI,
        }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem?.error || "Something went wrong.");
      }
      const data = await res.json();
      const a = data.answer || "";

      setMessages((prev) => [...prev, { role: "assistant", content: a }]);
    } catch (err) {
      setError(err.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#e6e6e6",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      {/* Header */}
      <SignedOut>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1>SSC 2.0 – Doctor Portal</h1>
          <p><a href="/sign-in">Sign in</a> to continue.</p>
        </div>
      </SignedOut>

      <SignedIn>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 20px",
            maxWidth: 1100,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src="/dr-spencer.jpg"
                alt="Dr. Spencer"
                width={40}
                height={40}
                style={{ borderRadius: "50%" }}
              />
              <small style={{ color: "#bdbdbd" }}>Ask Dr. Spencer</small>
            </div>
            <h1 style={{ margin: "6px 0 0 0" }}>SSC 2.0 – Doctor Portal</h1>
            <p style={{ marginTop: 10, color: "#cfcfcf", maxWidth: 880 }}>
              Ask Dr. Spencer is your Spencer Study Club powered assistant: a virtual Jamison if you will!
              Answering your sleep apnea and TMJ/TMD questions with clear, practical points right from the SSC modules. What’s your question?
            </p>
          </div>
          <UserButton />
        </div>

        {/* Conversation area */}
        <div
          ref={listRef}
          style={{
            maxWidth: 900,
            width: "100%",
            margin: "0 auto",
            padding: "0 20px 120px",
            overflowY: "auto",
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "#bdbdbd", marginTop: 20 }}>
              Start with a question, or tap a suggested prompt above.
            </div>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                margin: "12px 0",
              }}
            >
              <div
                style={{
                  background: m.role === "user" ? "#2a2a2a" : CARD,
                  border: "1px solid #333",
                  borderRadius: 16,
                  padding: "12px 14px",
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "grid", placeItems: "center", padding: "24px 0" }}>
              <div
                aria-label="Thinking…"
                style={{
                  width: 28,
                  height: 28,
                  border: "3px solid #2f2f2f",
                  borderTopColor: "#0ea5e9",
                  borderRadius: "50%",
                  animation: "spin 0.9s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, color: "#ffb4b4" }}>
              <b>Error:</b> {error}
            </div>
          )}
        </div>

        {/* Input bar fixed at bottom */}
        <form
          onSubmit={ask}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(180deg, rgba(33,33,33,0) 0%, #212121 30%)",
            padding: "18px 10px 16px",
            display: "grid",
            justifyItems: "center",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              width: "100%",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <textarea
              rows={1}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask anything…"
              style={{
                resize: "none",
                width: "100%",
                padding: "14px 16px",
                borderRadius: 999,
                border: "1px solid #3a3a3a",
                background: "#2a2a2a",
                color: "#eaeaea",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading) ask(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !q.trim()}
              aria-label="Send"
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: "1px solid #0ea5e9",
                background: loading ? "#214a5b" : "#0ea5e9",
                color: "#001018",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              ➤
            </button>
          </div>
        </form>
      </SignedIn>
    </main>
  );
}
