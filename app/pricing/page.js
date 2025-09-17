"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import PricingTable from "../../components/PricingTable";

export default function PricingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        background: "#212121",
        color: "#e6e6e6",
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
        }}
      >
        <a href="/" style={{ textDecoration: "none", color: "#e6e6e6" }}>
          <strong>SSC 2.0 – Doctor Portal</strong>
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
              }}
            >
              Sign in
            </a>
          </SignedOut>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          alignItems: "start",
          padding: "20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1100 }}>
          <PricingTable />
        </div>
      </div>
    </main>
  );
}
