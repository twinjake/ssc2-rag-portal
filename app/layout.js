// app/layout.js
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "SSC 2.0 – Doctor Portal",
  description: "Ask Dr. Spencer (SSC 2.0)",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const SYSTEM_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" style={{ overflowX: "hidden", background: "#212121" }}>
        <body
          style={{
            margin: 0,
            overflowX: "hidden",
            minHeight: "100vh",
            background: "#212121",
            color: "#EAEAEA",
            fontFamily: SYSTEM_SANS, // ← restore original system font
            fontSize: 16,
            lineHeight: 1.5,
          }}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
