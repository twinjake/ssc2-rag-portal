"use client";
import React from "react";

function Tier({
  name,
  price,
  cadence = "month",
  description,
  features = [],
  ctaLabel = "Subscribe",
  tierKey = "starter", // "starter" | "pro" | "team"
  highlight = false,
}) {
  const href = `/api/stripe/checkout?tier=${encodeURIComponent(tierKey)}`;
  return (
    <div
      style={{
        background: highlight ? "#1b1b1b" : "#181818",
        border: "1px solid #2a2a2a",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 360,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: highlight ? "0 6px 24px rgba(0,0,0,0.35)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 20 }}>{name}</h3>
        {highlight && (
          <span
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              background: "#2a2a2a",
              border: "1px solid #3a3a3a",
            }}
          >
            Most Popular
          </span>
        )}
      </div>

      <p style={{ margin: 0, color: "#bdbdbd", lineHeight: 1.5 }}>
        {description}
      </p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 36, fontWeight: 700 }}>${price}</span>
        <span style={{ color: "#bdbdbd" }}>/ {cadence}</span>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 18,
                height: 18,
                borderRadius: 9,
                border: "1px solid #3a3a3a",
                background: "#262626",
                marginTop: 2,
              }}
            />
            <span style={{ color: "#d6d6d6" }}>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={href}
        style={{
          marginTop: 8,
          textAlign: "center",
          display: "inline-block",
          padding: "12px 14px",
          borderRadius: 999,
          background: highlight ? "#0ea5e9" : "#2a2a2a",
          color: highlight ? "#001018" : "#e6e6e6",
          border: highlight ? "1px solid #0ea5e9" : "1px solid #3a3a3a",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        {ctaLabel}
      </a>
    </div>
  );
}

export default function PricingTable() {
  return (
    <section
      style={{
        width: "100%",
        display: "grid",
        justifyItems: "center",
        gap: 28,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 820 }}>
        <h1 style={{ marginBottom: 8 }}>Pricing</h1>
        <p style={{ margin: 0, color: "#bdbdbd", lineHeight: 1.6 }}>
          Pick the plan that matches your practice. You can upgrade or cancel anytime.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            alignItems: "stretch",
          }}
        >
          <Tier
            name="Starter"
            price="49"
            description="For solo learners getting started with SSC references and Q&A."
            features={[
              "Educational answers in Dr. Spencer’s voice",
              "Citations to SSC modules (KB-only)",
              "Basic usage limits",
              "Email support",
            ]}
            ctaLabel="Start"
            tierKey="starter"
          />
          <Tier
            name="Pro"
            price="99"
            description="For practitioners who use SSC references regularly."
            features={[
              "Everything in Starter",
              "Higher daily/monthly usage",
              "Priority support",
              "Early access to new features",
            ]}
            ctaLabel="Subscribe"
            tierKey="pro"
            highlight
          />
          <Tier
            name="Team"
            price="249"
            description="For small groups or practices that need shared access."
            features={[
              "Everything in Pro",
              "Seats for team members",
              "Team onboarding resources",
              "Priority support SLAs",
            ]}
            ctaLabel="Contact sales"
            tierKey="team"
          />
        </div>

        <p style={{ color: "#8c8c8c", fontSize: 14, marginTop: 8 }}>
          All plans are education-only and exclude medical advice.
        </p>
      </div>
    </section>
  );
}
