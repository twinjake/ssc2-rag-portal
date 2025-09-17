"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { marked } from "marked";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef(null);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const apply = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);

      html.style.background = "#212121";
      body.style.background = "#212121";
      body.style.color = "#EAEAEA";
      body.style.margin = "0";
      body.style.minHeight = "100vh";
      html.style.overflowX = "hidden";
      body.style.overflowX = "hidden";

      const allowScroll = loading || messages.length > 0;
      if (mobile) {
        html.style.overflowY = allowScroll ? "" : "hidden";
        body.style.overflowY = allowScroll ? "" : "hidden";
      } else {
        html.style.overflowY = "";
        body.style.overflowY = "";
      }
    };

    apply();
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [loading, messages.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) setQ((prev) => (prev ? prev + " " : "") + txt);
        else interim += txt;
      }
      if (inputRef.current) inputRef.current.placeholder = interim ? `🎤 ${interim}` : "Ask anything…";
    };

    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  function toggleMic() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setError("");
      rec.start();
      setListening(true);
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  async function sendMessage(text) {
    const content = (text ?? q).trim();
    if (!content || loading) return;

    setError("");

    const userMsg = { id: crypto.randomUUID(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);

    const pendingMsg = { id: "pending", role: "pending", content: "" };
    setMessages((prev) => [...prev, pendingMsg]);
    setQ("");
    setLoading(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem?.error || "Something went wrong.");
      }
      const data = await res.json();
      const answer = data.answer || "";

      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== "pending");
        return [...withoutPending, { id: crypto.randomUUID(), role: "assistant", content: answer }];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== "pending"));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e?.preventDefault?.();
    sendMessage(q);
  }

  const suggestions = [
    "Does a Farrar style night guard hold the jaw forward at night?",
    "I have a patient who, after TMJ treatment, is only hitting on their back teeth. What do I do?",
    "Do you have a prefered sleep appliance for patients with dentures?",
    "What's the difference between a reducing disc displacement and a non-reducing disc displacement?",
  ];

  const UserBubble = ({ children }) => (
    <div style={{ display: "flex", justifyContent: "flex-end", margin: "8px 0" }}>
      <div
        style={{
          maxWidth: 760,
          background: "#2A2A2A",
          border: "1px solid #3A3A3A",
          color: "#EAEAEA",
          padding: "10px 12px",
          borderRadius: 12,
          borderTopRightRadius: 4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          fontFamily: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );

  const AssistantBubble = ({ children }) => (
    <div style={{ display: "flex", gap: 10, margin: "10px 0" }}>
      <img
        src="/dr-spencer.jpg"
        alt="Dr. Spencer"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1px solid #424242",
          objectFit: "cover",
          marginTop: 2,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          maxWidth: 760,
          background: "#181818",
          border: "1px solid #2A2A2A",
          color: "#EAEAEA",
          padding: "12px 14px",
          borderRadius: 12,
          borderTopLeftRadius: 4,
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          fontFamily: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );

  const PendingBubble = () => (
    <div style={{ display: "flex", gap: 10, margin: "10px 0", alignItems: "center" }}>
      <img
        src="/dr-spencer.jpg"
        alt="Dr. Spencer"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1px solid #424242",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
      <div style={{ background: "#181818", border: "1px solid #2A2A2A", padding: "10px 12px", borderRadius: 12, fontFamily: "inherit" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#BDBDBD" }}>
          <svg width="24" height="24" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" stroke="#90CAF9" strokeWidth="4" fill="none" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite" />
            </circle>
          </svg>
          Thinking…
        </div>
      </div>
    </div>
  );

  return (
    <main
      style={{
        background: "#212121",
        minHeight: "100vh",
        color: "#EAEAEA",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <SignedOut>
        <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 800 }}>SSC 2.0 – Doctor Portal</h1>
            <p style={{ color: "#BDBDBD" }}>
              Please sign in to continue.&nbsp;&nbsp;
              <a href="/sign-in" style={{ color: "#90CAF9" }}>
                Go to Sign In
              </a>
            </p>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10 }}>
          <UserButton />
        </div>

        <section
          style={{
            maxWidth: 900,
            width: "100%",
            margin: "0 auto",
            padding: "96px 16px 12px",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              flexWrap: "wrap",
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <img
              src="/dr-spencer.jpg"
              alt="Dr. Spencer"
              style={{
                width: isMobile ? 56 : 64,
                height: isMobile ? 56 : 64,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid #424242",
                flexShrink: 0,
              }}
            />
            <div style={{ textAlign: isMobile ? "center" : "left", maxWidth: "100%" }}>
              <div style={{ fontSize: 14, color: "#BDBDBD" }}>Ask Dr. Spencer</div>
              <h1
                style={{
                  margin: 0,
                  fontSize: isMobile ? 36 : 42,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  lineHeight: 1.1,
                  wordBreak: "break-word",
                  fontFamily: "inherit", // ensure header uses system font
                }}
              >
                SSC 2.0 – Doctor Portal
              </h1>
            </div>
          </div>

          <p
            style={{
              margin: "8px auto 0",
              maxWidth: 820,
              color: "#D0D0D0",
              lineHeight: 1.6,
              fontSize: isMobile ? 17 : 18,
              padding: "0 4px",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              fontFamily: "inherit",
            }}
          >
            Ask Dr. Spencer is your Spencer Study Club powered assistant: a virtual Jamison if you will.
            Answering your sleep apnea and TMJ/TMD questions with clear, practical points right from the
            SSC modules. What’s your question?
          </p>

          {messages.length === 0 && (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 12,
                padding: "0 8px",
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => !loading && sendMessage(s)}
                  style={{
                    background: "#2A2A2A",
                    border: "1px solid #3A3A3A",
                    color: "#DADADA",
                    borderRadius: 20,
                    padding: "12px 14px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: isMobile ? 15 : 14,
                    opacity: loading ? 0.7 : 1,
                    maxWidth: "100%",
                    whiteSpace: "normal",
                    textAlign: "center",
                    boxSizing: "border-box",
                    fontFamily: "inherit", // chips match
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            maxWidth: 900,
            width: "100%",
            margin: "0 auto",
            padding: "8px 16px 140px",
            boxSizing: "border-box",
            overflowX: "hidden",
          }}
        >
          {error && (
            <div
              style={{
                margin: "12px auto",
                maxWidth: 900,
                color: "#FF8A80",
                background: "#2b1f1f",
                border: "1px solid #4a2a2a",
                padding: 12,
                borderRadius: 10,
                fontFamily: "inherit",
              }}
            >
              <b>Error:</b> {error}
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id}>{m.content}</UserBubble>
            ) : m.role === "assistant" ? (
              <AssistantBubble key={m.id}>
                <div
                  style={{ color: "#EAEAEA", fontFamily: "inherit" }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(m.content || "") }}
                />
              </AssistantBubble>
            ) : (
              <PendingBubble key={m.id} />
            )
          )}

          <div ref={endRef} style={{ height: 1 }} />
        </section>

        <form
          onSubmit={onSubmit}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "16px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)",
            background: "linear-gradient(180deg, rgba(33,33,33,0) 0%, rgba(33,33,33,0.85) 30%, #212121 65%)",
            display: "flex",
            justifyContent: "center",
            zIndex: 9,
            overflowX: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: 900,
              width: "100%",
              display: "grid",
              gridTemplateColumns: "48px 1fr 48px",
              alignItems: "center",
              gap: 8,
              background: "#2A2A2A",
              border: "1px solid #3A3A3A",
              borderRadius: 28,
              padding: "6px 8px",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          >
            <button
              type="button"
              onClick={toggleMic}
              title="Voice input"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                border: "none",
                background: listening ? "#3949AB" : "transparent",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: listening ? "#EAEAEA" : "#BDBDBD",
                fontFamily: "inherit",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zM11 19h2v3h-2z" />
              </svg>
            </button>

            {/* chat input — font matches exactly */}
            <textarea
              ref={inputRef}
              rows={1}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask anything…"
              style={{
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#EAEAEA",
                padding: "10px 6px",
                fontSize: 16,
                lineHeight: 1.4,
                maxHeight: 140,
                overflowX: "hidden",
                fontFamily: "inherit", // ← match system font
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(q);
                }
              }}
            />

            <button
              type="submit"
              disabled={loading || !q.trim()}
              title="Send"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                border: "none",
                background: loading || !q.trim() ? "#37474F" : "#1976D2",
                cursor: loading || !q.trim() ? "not-allowed" : "pointer",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                transition: "background 0.2s",
                fontFamily: "inherit",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ transform: "translateX(1px)" }}>
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </div>
        </form>
      </SignedIn>
    </main>
  );
}
