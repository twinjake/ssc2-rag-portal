import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "SSC 2.0 – Doctor Portal",
  description: "Private, education-only Q&A for SSC 2.0"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <div style={{ maxWidth: 860, margin: "32px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
            {children}
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
