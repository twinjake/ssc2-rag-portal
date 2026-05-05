"use client";

import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState, useCallback } from "react";
import { marked } from "marked";

const FREE_LIMIT = 3;
const SESSIONS_KEY = "ssc2_sessions_v1";

// ─── helpers ────────────────────────────────────────────────────────────────

function newSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveSessions(sessions) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch {}
}

function sessionTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  const t = first.content.trim();
  return t.length > 40 ? t.slice(0, 40) + "…" : t;
}

function formatAssistantHTML(text) {
  const raw = text || "";
  const fallbackRe = /that's a great question\.[\s\S]*?facebook group\./i;
  const fallbackMatch = raw.match(fallbackRe);
  if (fallbackMatch) return marked.parse(fallbackMatch[0].trim());

  const base = raw
    .replace(/You can\s+also\s+browse the SSC Library here:\s*https?:\/\/\S+/gi, "")
    .replace(/You can\s+browse the SSC Library here:\s*https?:\/\/\S+/gi, "")
    .replace(/You can\s+browse the SSC Library HERE/gi, "")
    .replace(/Visit the SSC Library HERE/gi, "");

  const footer =
    '\n\nVisit the SSC Library ' +
    '<a href="https://www.spencerstudyclub.com/library" target="_blank" rel="noopener">' +
    '<strong style="color:#1976D2;text-decoration:underline">HERE</strong></a>';

  return marked.parse(base + footer);
}

// ─── sub-components ─────────────────────────────────────────────────────────

const UserBubble = ({ children }) => (
  <div style={{ display: "flex", justifyContent: "flex-end", margin: "8px 0" }}>
    <div style={{ maxWidth: 720, background: "#2A2A2A", border: "1px solid #3A3A3A", color: "#EAEAEA", padding: "10px 14px", borderRadius: 14, borderTopRightRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: 15 }}>
      {children}
    </div>
  </div>
);

const AssistantBubble = ({ children }) => (
  <div style={{ display: "flex", gap: 10, margin: "10px 0" }}>
    <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #424242", objectFit: "cover", marginTop: 2, flexShrink: 0 }} />
    <div style={{ maxWidth: 720, background: "#181818", border: "1px solid #2A2A2A", color: "#EAEAEA", padding: "12px 16px", borderRadius: 14, borderTopLeftRadius: 4, wordBreak: "break-word", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: 15 }}>
      {children}
    </div>
  </div>
);

// iMessage-style three-dot typing indicator
const PendingBubble = () => (
  <div style={{ display: "flex", gap: 10, margin: "10px 0", alignItems: "flex-end" }}>
    <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #424242", objectFit: "cover", flexShrink: 0 }} />
    <div style={{ background: "#181818", border: "1px solid #2A2A2A", padding: "12px 16px", borderRadius: 18, borderBottomLeftRadius: 4, display: "flex", alignItems: "center", gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: "#888", display: "block",
          animation: `ssc-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
    <style>{`
      @keyframes ssc-dot {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-5px); opacity: 1; }
      }
    `}</style>
  </div>
);

// Streaming bubble — renders markdown as text streams in
const StreamingBubble = ({ text }) => (
  <div style={{ display: "flex", gap: 10, margin: "10px 0" }}>
    <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #424242", objectFit: "cover", marginTop: 2, flexShrink: 0 }} />
    <div style={{ maxWidth: 720, background: "#181818", border: "1px solid #2A2A2A", color: "#EAEAEA", padding: "12px 16px", borderRadius: 14, borderTopLeftRadius: 4, wordBreak: "break-word", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: 15 }}>
      <div style={{ color: "#EAEAEA", fontFamily: "inherit" }} dangerouslySetInnerHTML={{ __html: formatAssistantHTML(text) }} />
      <span style={{ display: "inline-block", width: 2, height: "1em", background: "#90CAF9", marginLeft: 2, verticalAlign: "text-bottom", animation: "ssc-blink 0.8s step-end infinite" }} />
      <style>{`@keyframes ssc-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  </div>
);

// ─── landing page ──────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", color: "#EAEAEA", fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes lp-fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-pulse-ring { 0%,100% { box-shadow: 0 0 0 0 rgba(25,118,210,0.4); } 50% { box-shadow: 0 0 0 16px rgba(25,118,210,0); } }
        .lp-hero-btn:hover { background: #1565C0 !important; transform: translateY(-1px); }
        .lp-card:hover { border-color: #1976D2 !important; transform: translateY(-3px); }
        .lp-nav-link:hover { color: #90CAF9 !important; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,15,15,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e1e1e", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "2px solid #1976D2" }} />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>Ask Dr. Spencer</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <a href="/pricing" className="lp-nav-link" style={{ color: "#aaa", textDecoration: "none", fontSize: 14, transition: "color 0.2s" }}>Pricing</a>
            <a href="/sign-in" style={{ padding: "8px 20px", background: "#1976D2", color: "#fff", borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "background 0.2s" }}>Sign In</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center", animation: "lp-fade-up 0.7s ease both" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a2a3a", border: "1px solid #1976D244", borderRadius: 999, padding: "6px 16px", fontSize: 13, color: "#90CAF9", marginBottom: 28 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4CAF50", display: "inline-block", animation: "lp-pulse-ring 2s ease infinite" }} />
          Powered by Spencer Study Club
        </div>
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
          <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: "3px solid #1976D2", boxShadow: "0 0 0 6px rgba(25,118,210,0.15)" }} />
        </div>
        <h1 style={{ margin: "0 0 20px", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -1 }}>
          Get answers from<br />
          <span style={{ color: "#1976D2" }}>Dr. Spencer</span> — instantly.
        </h1>
        <p style={{ margin: "0 auto 36px", maxWidth: 640, fontSize: 18, color: "#BDBDBD", lineHeight: 1.7 }}>
          Ask Dr. Spencer is your AI-powered study partner built on the full Spencer Study Club library. Ask any sleep apnea or TMD/TMJ question and get answers in Dr. Spencer&apos;s own voice, backed by his exact words from SSC modules.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/sign-up" className="lp-hero-btn" style={{ padding: "15px 36px", background: "#1976D2", color: "#fff", borderRadius: 999, fontSize: 16, fontWeight: 700, textDecoration: "none", transition: "background 0.2s, transform 0.15s", display: "inline-block" }}>
            Start for Free
          </a>
          <a href="/sign-in" style={{ padding: "15px 36px", background: "transparent", color: "#EAEAEA", border: "1px solid #3a3a3a", borderRadius: 999, fontSize: 16, fontWeight: 600, textDecoration: "none", transition: "border-color 0.2s", display: "inline-block" }}>
            Sign In
          </a>
        </div>
      </section>

      {/* Feature cards */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[
            {
              icon: "💬",
              title: "His exact words",
              body: "Every answer is built from Dr. Spencer\u2019s own SSC module transcripts. You\u2019re not getting a paraphrase \u2014 you\u2019re getting the real thing.",
            },
            {
              icon: "🦷",
              title: "Sleep & TMD covered",
              body: "From mandibular advancement devices to disc displacements, Ask Dr. Spencer covers the full SSC curriculum across all levels.",
            },
            {
              icon: "📚",
              title: "Cites the source",
              body: "Every response tells you exactly which SSC module the answer came from, so you can go deeper in the library any time.",
            },
          ].map((card) => (
            <div key={card.title} className="lp-card" style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 16, padding: "28px 24px", transition: "border-color 0.2s, transform 0.2s" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{card.icon}</div>
              <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>{card.title}</h3>
              <p style={{ margin: 0, color: "#BDBDBD", lineHeight: 1.65, fontSize: 15 }}>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote / testimonial */}
      <section style={{ background: "#141a24", borderTop: "1px solid #1e2a3a", borderBottom: "1px solid #1e2a3a", padding: "60px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "clamp(18px, 3vw, 26px)", fontStyle: "italic", color: "#D0D0D0", lineHeight: 1.65, margin: "0 0 20px" }}>
            &ldquo;You could actually do this over dentures if you wanted to. The interlocking appliance is great for that.&rdquo;
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #1976D2" }} />
            <span style={{ color: "#90CAF9", fontWeight: 600, fontSize: 14 }}>Dr. Jamison Spencer &mdash; SSC Module 115</span>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800 }}>Simple pricing</h2>
        <p style={{ color: "#BDBDBD", fontSize: 16, lineHeight: 1.6, marginBottom: 36 }}>
          3 free questions to get started. Then $15.99/month for unlimited access.
        </p>
        <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 20, padding: "36px 32px", marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: "#90CAF9", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Unlimited</div>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, marginBottom: 6 }}>$15.99</div>
          <div style={{ color: "#888", fontSize: 14, marginBottom: 28 }}>per month &mdash; cancel any time</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", textAlign: "left", display: "inline-block" }}>
            {["Unlimited questions", "Full SSC library coverage", "Dr. Spencer\u2019s exact voice", "Source citations on every answer"].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 15, color: "#D0D0D0" }}>
                <span style={{ color: "#4CAF50", fontSize: 18, lineHeight: 1 }}>&#10003;</span> {f}
              </li>
            ))}
          </ul>
          <a href="/sign-up" style={{ display: "block", padding: "14px 20px", background: "#1976D2", color: "#fff", borderRadius: 999, fontSize: 16, fontWeight: 700, textDecoration: "none" }}>
            Get Started Free
          </a>
        </div>
        <p style={{ color: "#555", fontSize: 13 }}>Already a member? <a href="/sign-in" style={{ color: "#90CAF9", textDecoration: "none" }}>Sign in</a></p>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1e1e1e", padding: "24px", textAlign: "center", color: "#555", fontSize: 13 }}>
        <p style={{ margin: 0 }}>
          &copy; {new Date().getFullYear()} Ask Dr. Spencer &mdash; Powered by{" "}
          <a href="https://www.spencerstudyclub.com" target="_blank" rel="noopener" style={{ color: "#90CAF9", textDecoration: "none" }}>Spencer Study Club</a>
        </p>
      </footer>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useUser();

  // Chat state
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState(""); // text being streamed in
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("both");
  const [listening, setListening] = useState(false);

  // Freemium state
  const [userStatus, setUserStatus] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef(null);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const activeIdRef = useRef(activeId);

  // Keep ref in sync with state for use inside async callbacks
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // ── Detect mobile ──
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Body styles ──
  useEffect(() => {
    document.documentElement.style.background = "#212121";
    document.body.style.background = "#212121";
    document.body.style.margin = "0";
    document.body.style.color = "#EAEAEA";
  }, []);

  // ── Fetch user status ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/user/status");
      if (res.ok) {
        const data = await res.json();
        setUserStatus(data);
        if (!data.canChat) setShowPaywall(true);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Check for subscription redirect ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "1") {
      fetchStatus();
      window.history.replaceState({}, "", "/");
    }
  }, [fetchStatus]);

  // ── Load sessions from localStorage on mount ──
  useEffect(() => {
    const stored = loadSessions();
    if (stored.length > 0) {
      setSessions(stored);
      // Always start a fresh blank chat on login
      startNewChatInternal(stored);
    } else {
      startNewChatInternal([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist sessions whenever they change ──
  useEffect(() => {
    if (sessions.length > 0) saveSessions(sessions);
  }, [sessions]);

  // ── Scroll to bottom ──
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading, streamingText]);

  // ── Speech recognition ──
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
    if (listening) { rec.stop(); setListening(false); }
    else { setError(""); rec.start(); setListening(true); }
  }

  // ── Session management (internal — always takes explicit list) ──
  function startNewChatInternal(existingList) {
    const id = newSessionId();
    const newSession = { id, title: "New Chat", messages: [], createdAt: Date.now() };
    const updated = [newSession, ...existingList];
    setSessions(updated);
    setActiveId(id);
    activeIdRef.current = id;
    setMessages([]);
    setQ("");
    setError("");
    setStreamingText("");
    saveSessions(updated);
    return id;
  }

  // ── New Chat button handler — skip if current chat is already empty ──
  function handleNewChat() {
    // If the current active session has no messages, just focus the input
    const currentSess = sessions.find((s) => s.id === activeId);
    if (currentSess && currentSess.messages.length === 0) {
      inputRef.current?.focus();
      if (isMobile) setSidebarOpen(false);
      return;
    }
    startNewChatInternal(sessions);
    if (isMobile) setSidebarOpen(false);
  }

  function switchToSession(id) {
    const sess = sessions.find((s) => s.id === id);
    if (!sess) return;
    setActiveId(id);
    setMessages(sess.messages);
    setQ("");
    setError("");
    setStreamingText("");
    if (isMobile) setSidebarOpen(false);
  }

  function deleteSession(id, e) {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    saveSessions(updated);
    if (activeId === id) {
      if (updated.length > 0) {
        switchToSession(updated[0].id);
      } else {
        startNewChatInternal([]);
      }
    }
  }

  // ── Update session messages in state ──
  function updateSessionMessages(id, newMessages) {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, messages: newMessages, title: sessionTitle(newMessages) };
      });
      saveSessions(updated);
      return updated;
    });
  }

  // ── Send message with streaming typewriter effect ──
  async function sendMessage(text) {
    const content = (text ?? q).trim();
    if (!content || loading) return;

    if (userStatus && !userStatus.canChat) {
      setShowPaywall(true);
      return;
    }

    const suffix =
      topic === "tmd" ? "This question is TMD/TMJ related"
      : topic === "sleep" ? "This question is Sleep Apnea related"
      : "";
    const augmented = (content + (suffix ? " " + suffix : "")).trim();

    setError("");
    const userMsg = { id: crypto.randomUUID(), role: "user", content, augmented };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { id: "pending", role: "pending", content: "" }]);
    setQ("");
    setLoading(true);
    setStreamingText("");

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.role === "user" ? (m.augmented || m.content) : m.content }));

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: augmented, history }),
      });

      if (res.status === 402) {
        setMessages(newMessages);
        setShowPaywall(true);
        await fetchStatus();
        return;
      }

      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem?.error || "Something went wrong.");
      }

      const data = await res.json();
      const answer = data.answer || "";

      // Remove pending bubble, show streaming bubble
      setMessages([...newMessages, { id: "streaming", role: "streaming", content: "" }]);

      // Typewriter effect — stream characters in chunks
      const CHUNK = 4; // characters per tick
      const DELAY = 12; // ms per tick
      let i = 0;
      await new Promise((resolve) => {
        function tick() {
          i = Math.min(i + CHUNK, answer.length);
          setStreamingText(answer.slice(0, i));
          if (i < answer.length) {
            setTimeout(tick, DELAY);
          } else {
            resolve();
          }
        }
        tick();
      });

      // Streaming done — replace with final committed message
      const assistantMsg = { id: crypto.randomUUID(), role: "assistant", content: answer };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      setStreamingText("");
      updateSessionMessages(activeIdRef.current, finalMessages);

      await fetchStatus();
    } catch (err) {
      setMessages(newMessages);
      setStreamingText("");
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e?.preventDefault?.();
    sendMessage(q);
  }

  // ── Paywall modal ──
  const PaywallModal = () => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#181818", border: "1px solid #2a2a2a", borderRadius: 20, padding: "40px 32px", maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700 }}>You&apos;ve used your 3 free chats</h2>
        <p style={{ color: "#bdbdbd", lineHeight: 1.6, marginBottom: 28 }}>
          Subscribe for <strong style={{ color: "#0ea5e9" }}>$15.99/month</strong> to get unlimited access to Ask Dr. Spencer.
        </p>
        <a href="/api/stripe/checkout" style={{ display: "block", padding: "14px 20px", borderRadius: 999, background: "#0ea5e9", color: "#001018", fontWeight: 700, fontSize: 16, textDecoration: "none", marginBottom: 12 }}>
          Subscribe — $15.99/mo
        </a>
        <a href="/pricing" style={{ display: "block", color: "#888", fontSize: 14, textDecoration: "none" }}>Learn more</a>
      </div>
    </div>
  );

  // ── Trial banner ──
  const TrialBanner = () => {
    if (!userStatus || userStatus.plan !== "free_trial" || !userStatus.chatsRemaining) return null;
    const remaining = userStatus.chatsRemaining;
    if (remaining <= 0) return null;
    return (
      <div style={{ background: "#1e3a4a", border: "1px solid #0ea5e944", borderRadius: 8, padding: "7px 12px", marginBottom: 8, fontSize: 12, color: "#7dd3fc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span>
          {remaining === FREE_LIMIT ? `You have ${remaining} free chats to try Ask Dr. Spencer.`
            : remaining === 1 ? `⚠️ This is your last free chat.`
            : `You have ${remaining} free chat${remaining !== 1 ? "s" : ""} remaining.`}
        </span>
        <a href="/pricing" style={{ color: "#0ea5e9", fontWeight: 600, textDecoration: "none", fontSize: 11 }}>Subscribe →</a>
      </div>
    );
  };

  // ── Sidebar ──
  const Sidebar = () => (
    <>
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 49 }} />
      )}

      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: 260,
        background: "#171717",
        borderRight: "1px solid #2a2a2a",
        display: "flex", flexDirection: "column",
        zIndex: 50,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-260px)",
        transition: "transform 0.25s ease",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 12px 8px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #2a2a2a" }}>
          <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid #424242", flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ask Dr. Spencer</span>
          <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4, borderRadius: 4, fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* New Chat button */}
        <div style={{ padding: "10px 10px 6px" }}>
          <button
            onClick={handleNewChat}
            style={{ width: "100%", padding: "9px 12px", background: "#1976D2", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
          >
            <span style={{ fontSize: 16 }}>＋</span> New Chat
          </button>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px" }}>
          {sessions.length === 0 && (
            <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: "20px 10px" }}>No chats yet</div>
          )}
          {sessions.map((sess) => {
            const isActive = sess.id === activeId;
            return (
              <div
                key={sess.id}
                onClick={() => switchToSession(sess.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: isActive ? "#2a2a2a" : "transparent",
                  marginBottom: 2,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#1e1e1e"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isActive ? "#eaeaea" : "#aaa" }}>
                  💬 {sess.title}
                </span>
                <button
                  onClick={(e) => deleteSession(sess.id, e)}
                  style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "2px 4px", borderRadius: 4, fontSize: 13, flexShrink: 0, lineHeight: 1 }}
                  title="Delete chat"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>

        {/* User info at bottom */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 10 }}>
          <UserButton />
          <span style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.primaryEmailAddress?.emailAddress || user?.fullName || ""}
          </span>
        </div>
      </aside>
    </>
  );

  const mainLeft = sidebarOpen ? 260 : 0;
  const isEmptyChat = messages.filter((m) => m.role !== "pending" && m.role !== "streaming").length === 0 && !streamingText;

  return (
    <main style={{ background: "#212121", minHeight: "100vh", color: "#EAEAEA", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
      {showPaywall && <PaywallModal />}

      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        <Sidebar />

        {/* Sidebar toggle button */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          style={{
            position: "fixed", top: 14, left: sidebarOpen ? 270 : 14, zIndex: 51,
            background: "#2a2a2a", border: "1px solid #3a3a3a", color: "#ccc",
            borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 18, lineHeight: 1,
            transition: "left 0.25s ease",
          }}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? "◀" : "☰"}
        </button>

        {/* Main content area */}
        <div style={{
          marginLeft: isMobile ? 0 : mainLeft,
          transition: "margin-left 0.25s ease",
          display: "flex", flexDirection: "column", minHeight: "100vh",
        }}>
          {/* Header — always shown */}
          <section style={{ maxWidth: 860, width: "100%", margin: "0 auto", padding: "80px 16px 12px", textAlign: "center", boxSizing: "border-box" }}>
            <div style={{ display: "grid", justifyItems: "center", alignItems: "center", marginBottom: 8, rowGap: 10 }}>
              <img src="/dr-spencer.jpg" alt="Dr. Spencer" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "1px solid #424242" }} />
              <div>
                <div style={{ fontSize: 13, color: "#BDBDBD" }}>Ask Dr. Spencer</div>
                <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.1 }}>SSC 2.0 – Doctor Portal</h1>
              </div>
            </div>
            {isEmptyChat && (
              <p style={{ margin: "8px auto 0", maxWidth: 760, color: "#D0D0D0", lineHeight: 1.6, fontSize: 16, padding: "0 4px" }}>
                Ask Dr. Spencer is your Spencer Study Club powered assistant. Answering your sleep apnea and TMJ/TMD questions with clear, practical points right from the SSC modules.
              </p>
            )}
          </section>

          {/* Messages */}
          <section style={{ maxWidth: 860, width: "100%", margin: "0 auto", padding: "8px 16px 180px", boxSizing: "border-box" }}>
            {error && (
              <div style={{ margin: "12px auto", color: "#FF8A80", background: "#2b1f1f", border: "1px solid #4a2a2a", padding: 12, borderRadius: 10, fontFamily: "inherit" }}>
                <b>Error:</b> {error}
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id}>{m.content}</UserBubble>
              ) : m.role === "assistant" ? (
                <AssistantBubble key={m.id}>
                  <div style={{ color: "#EAEAEA", fontFamily: "inherit" }} dangerouslySetInnerHTML={{ __html: formatAssistantHTML(m.content) }} />
                </AssistantBubble>
              ) : m.role === "streaming" ? (
                <StreamingBubble key="streaming" text={streamingText} />
              ) : (
                <PendingBubble key={m.id} />
              )
            )}

            <div ref={endRef} style={{ height: 1 }} />
          </section>

          {/* Input bar */}
          <form
            onSubmit={onSubmit}
            style={{ position: "fixed", left: isMobile ? 0 : mainLeft, right: 0, bottom: 0, padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)", background: "linear-gradient(180deg, rgba(33,33,33,0) 0%, rgba(33,33,33,0.9) 30%, #212121 65%)", display: "flex", flexDirection: "column", alignItems: "center", zIndex: 9, transition: "left 0.25s ease" }}
          >
            <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", boxSizing: "border-box" }}>
              <TrialBanner />
            </div>

            {/* Topic selector */}
            <div style={{ width: "100%", maxWidth: 860, margin: "0 auto 8px", display: "flex", justifyContent: "center", boxSizing: "border-box" }}>
              <div role="radiogroup" aria-label="Question topic" style={{ display: "flex", background: "#2A2A2A", border: "1px solid #3A3A3A", borderRadius: 9999, padding: 3, gap: 3 }}>
                {["tmd", "sleep", "both"].map((key) => {
                  const label = key === "tmd" ? "TMD" : key === "sleep" ? "Sleep Apnea" : "Both";
                  const selected = topic === key;
                  return (
                    <button key={key} type="button" role="radio" aria-checked={selected} onClick={() => setTopic(key)}
                      style={{ cursor: "pointer", border: "none", outline: "none", padding: "7px 13px", borderRadius: 9999, background: selected ? "#1976D2" : "transparent", color: selected ? "#fff" : "#E0E0E0", fontSize: 13, fontFamily: "inherit", transition: "background 0.2s, color 0.2s" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Text input */}
            <div style={{ maxWidth: 860, width: "100%", display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 6, background: "#2A2A2A", border: "1px solid #3A3A3A", borderRadius: 26, padding: "5px 7px", boxSizing: "border-box", fontFamily: "inherit" }}>
              <button type="button" onClick={toggleMic} title="Voice input"
                style={{ width: 38, height: 38, borderRadius: 19, border: "none", background: listening ? "#3949AB" : "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: listening ? "#EAEAEA" : "#BDBDBD", fontFamily: "inherit" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zM11 19h2v3h-2z" />
                </svg>
              </button>

              <textarea
                ref={inputRef}
                rows={1}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={userStatus && !userStatus.canChat ? "Subscribe to continue chatting…" : "Ask anything…"}
                disabled={userStatus && !userStatus.canChat}
                style={{ resize: "none", background: "transparent", border: "none", outline: "none", color: "#EAEAEA", padding: "9px 6px", fontSize: 15, lineHeight: 1.4, maxHeight: 140, overflowX: "hidden", fontFamily: "inherit", opacity: userStatus && !userStatus.canChat ? 0.5 : 1 }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(q); } }}
              />

              <button type="submit" disabled={loading || !q.trim() || (userStatus && !userStatus.canChat)} title="Send"
                style={{ width: 38, height: 38, borderRadius: 19, border: "none", background: loading || !q.trim() || (userStatus && !userStatus.canChat) ? "#37474F" : "#1976D2", cursor: loading || !q.trim() || (userStatus && !userStatus.canChat) ? "not-allowed" : "pointer", display: "grid", placeItems: "center", color: "#fff", transition: "background 0.2s", fontFamily: "inherit" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ transform: "translateX(1px)" }}>
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </SignedIn>
    </main>
  );
}
