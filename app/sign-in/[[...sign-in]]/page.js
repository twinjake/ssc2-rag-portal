"use client";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
