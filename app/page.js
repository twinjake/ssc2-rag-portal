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
  const [topic, setTopic] = useState("both");

  const inputRef = useRef(null);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);

  // Helper: post-process assistant text
  // - If it contains the "great question / FB group" fallback, show ONLY that block.
  // - Otherwise, optional follow-up "conversationalize" pass that strips rigid section headers.
  // - Then clean any older library lines and append the standardized library link.
  function formatAssistantHTML(text, { isFollowup = false } = {}) {
    const raw = text || "";

    const fallbackRe = /that's a great question\.[\s\S]*?facebook group\./i;
    const fallbackMatch = raw.match(fallbackRe);
    if (fallbackMatch) {
      return marked.parse(fallbackMatch[0].trim());
    }

    let body = raw;
    if (isFollowup) {
      const headingWords = [
        "Summary",
        "What matters",
        "How I think about it",
        "How I think about this",
        "Actionable steps",
        "Action steps",
        "In short",
        "Key points",
        "TL;DR",
      ];
      const headingPattern =
        String.raw`^\s{0,3}(?:#+\s*)?(?:\*\*|__)?(?:${headingWords
          .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})(?:\*\*|__)?\s*:?\s*$`;

      body = body
        .replace(new RegExp(headingPattern, "gim"), "")
        .replace(/\n{3,}/g, "\n\n");
    }

    const cleaned = body
      .replace(/You can\s+also\s+browse the SSC Library here:\s*https?:\/\/\S+/gi, "")
      .replace(/You can\s+browse the SSC Library here:\s*https?:\/\/\S+/gi, "")
      .replace(/You can\s+browse the SSC Library HERE/gi, "")
      .replace(/Visit the SSC Library HERE/gi, "");

    const footer =
      '\n\nVisit the SSC Library ' +
      '<a href="https://www.spencerstudyclub.com/library" target="_blank" rel="noopener">' +
      '<strong style="color:#1976D2;text-decoration:underline">HERE</strong></a>';

    return marked.parse(cleaned + footer);
  }

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

  // Voice input
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

  // NOTE: No localStorage — memory is in-RAM only for the current session.
  // Reloading the page resets the conversation.

  async function sendMessage(text) {
    const content = (text ?? q).trim();
    const suffix =
      topic === "tmd"
        ? "This question is TMD/TMJ related"
        : topic === "sleep"
        ? "This question is Sleep Apnea related"
        : ""; // BOTH => no additional prompt
    const augmented = (content + (suffix ? " " + suffix : "")).trim();
    if (!content || loading) return;

    setError("");

    // Store user-visible content + hidden augmented field (in-memory only)
    const userMsg = { id: crypto.randomUUID(), role: "user", content, augmented };
    setMessages((prev) => [...prev, userMsg]);

    const pendingMsg = { id: "pending", role: "pending", content: "" };
    setMessages((prev) => [...prev, pendingMsg]);
    setQ("");
    setLoading(true);

    try {
      // Use augmented text for prior user turns if present (from in-memory history)
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.role === "user" ? (m.augmented || m.content) : m.content,
        }));

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: augmented, history }),
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
          wordBreak: "word-break",
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

  // We'll count assistant replies as we render so we know what's a follow-up.
  let assistantRenderCount = 0;

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
              <a href="/sign-in" style={{ color: "#90CAF9" }}>Go to Sign In</a>
            </p>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10 }}>
          <UserButton />
        </div>

        {/* Header */}
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
              display: "grid",
              justifyItems: "center",
              alignItems: "center",
              marginBottom: 8,
              rowGap: 10,
            }}
          >
            <img
              src="/dr-spencer.jpg"
              alt="Dr. Spencer"
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid #424242",
              }}
            />
            <div style={{ textAlign: "center", maxWidth: "100%" }}>
              <div style={{ fontSize: 14, color: "#BDBDBD" }}>Ask Dr. Spencer</div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 42,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  lineHeight: 1.1,
                  wordBreak: "break-word",
                  fontFamily: "inherit",
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
              fontSize: 18,
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
              {[
                "Does a Farrar style night guard hold the jaw forward at night?",
                "I have a patient who, after TMJ treatment, is only hitting on their back teeth. What do I do?",
                "Do you have a prefered sleep appliance for patients with dentures?",
                "What's the difference between a reducing disc displacement and a non-reducing disc displacement?",
              ].map((s, i) => (
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
                    fontSize: 14,
                    opacity: loading ? 0.7 : 1,
                    maxWidth: "100%",
                    whiteSpace: "normal",
                    textAlign: "center",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
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

          {messages.map((m) => {
            if (m.role === "user") {
              return <UserBubble key={m.id}>{m.content}</UserBubble>;
            }
            if (m.role === "assistant") {
              const isFollowup = assistantRenderCount++ > 0; // first assistant = false, others = true
              return (
                <AssistantBubble key={m.id}>
                  <div
                    style={{ color: "#EAEAEA", fontFamily: "inherit" }}
                    dangerouslySetInnerHTML={{ __html: formatAssistantHTML(m.content, { isFollowup }) }}
                  />
                </AssistantBubble>
              );
            }
            return <PendingBubble key={m.id} />;
          })}

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
            flexDirection: "column",
            alignItems: "center",
            zIndex: 9,
            overflowX: "hidden",
          }}
        >
          {/* Topic selector (segmented iOS-style) */}
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              margin: "0 auto 10px",
              display: "grid",
              gap: 8,
              justifyItems: "center",
              boxSizing: "border-box",
            }}
          >
            <div
              role="radiogroup"
              aria-label="Question topic"
              style={{
                display: "flex",
                background: "#2A2A2A",
                border: "1px solid #3A3A3A",
                borderRadius: 9999,
                padding: 4,
                gap: 4,
              }}
            >
              {["tmd", "sleep", "both"].map((key) => {
                const label = key === "tmd" ? "TMD" : key === "sleep" ? "Sleep Apnea" : "Both";
                const selected = topic === key;
                return (
                  <button
                    key={key}
                    type="button" // prevent form submit on click
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTopic(key)}
                    style={{
                      cursor: "pointer",
                      border: "none",
                      outline: "none",
                      padding: "8px 14px",
                      borderRadius: 9999,
                      background: selected ? "#1976D2" : "transparent",
                      color: selected ? "#FFFFFF" : "#E0E0E0",
                      fontSize: 14,
                      fontFamily: "inherit",
                      transition: "background 0.2s, color 0.2s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

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
                fontFamily: "inherit",
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
