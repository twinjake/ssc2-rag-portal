"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function PricingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#212121",
        color: "#e6e6e6",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 20px",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <a href="/" style={{ textDecoration: "none", color: "#e6e6e6" }}>
          <strong>Ask Dr. Spencer</strong>
        </a>
        <div>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <a
              href="/sign-in"
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #3a2a2a",
                background: "#2a2a2a",
                textDecoration: "none",
                color: "#e6e6e6",
              }}
            >
              Sign in
            </a>
          </SignedOut>
        </div>
      </div>

      {/* Pricing content */}
      <div
        style={{
          maxWidth: 520,
          margin: "60px auto",
          padding: "0 20px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
          Unlock Unlimited Access
        </h1>
        <p style={{ color: "#bdbdbd", lineHeight: 1.6, marginBottom: 40 }}>
          You&apos;ve used your 3 free chats. Subscribe to continue getting
          AI-powered answers from Spencer Study Club content — in Dr.
          Spencer&apos;s own voice.
        </p>

        {/* Plan card */}
        <div
          style={{
            background: "#181818",
            border: "1px solid #2a2a2a",
            borderRadius: 20,
            padding: "36px 32px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: 999,
              background: "#0ea5e922",
              color: "#0ea5e9",
              border: "1px solid #0ea5e944",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            UNLIMITED PLAN
          </div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 52, fontWeight: 800 }}>$9.99</span>
            <span style={{ color: "#bdbdbd", fontSize: 18 }}>/month</span>
          </div>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 28 }}>Cancel anytime</p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 32px",
              display: "grid",
              gap: 12,
              textAlign: "left",
            }}
          >
            {[
              "Unlimited AI-powered Q&A",
              "Answers grounded in SSC content",
              "Dr. Spencer's voice and teaching style",
              "TMD/TMJ and Sleep Apnea coverage",
              "Module citations included",
            ].map((f) => (
              <li key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#22c55e", fontSize: 16, marginTop: 1 }}>✓</span>
                <span style={{ color: "#d6d6d6", fontSize: 15 }}>{f}</span>
              </li>
            ))}
          </ul>

          <a
            href="/api/stripe/checkout"
            style={{
              display: "block",
              padding: "14px 20px",
              borderRadius: 999,
              background: "#0ea5e9",
              color: "#001018",
              fontWeight: 700,
              fontSize: 16,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Subscribe Now — $9.99/mo
          </a>
        </div>

        <p style={{ color: "#555", fontSize: 12, marginTop: 20 }}>
          Education-only. Not medical advice.
        </p>
      </div>
    </main>
  );
}
