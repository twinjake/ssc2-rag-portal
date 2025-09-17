// app/layout.js
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "SSC 2.0 – Doctor Portal",
  description: "Ask Dr. Spencer (SSC 2.0)",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },        // optional for older browsers
      { url: "/favicon.png", type: "image/png" },   // modern
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          style={{
            margin: 0,
            background: "#212121",
            color: "#e6e6e6",
            overflowX: "hidden",
            minHeight: "100vh",
          }}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
