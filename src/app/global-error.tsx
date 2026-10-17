"use client";

// Root-layout error boundary — catches a crash in the root layout itself
// (the one place src/app/error.tsx can't reach, since error.tsx is wrapped
// BY the root layout, not around it). Must render its own <html>/<body>
// and can't rely on global.css or Tailwind classes being loaded (per
// Next.js's own docs: global-error renders its own document, no app
// styles) — hence inline styles here instead of the classNames error.tsx
// uses. Same content/behaviour otherwise: never show the real message or
// stack (spec §59), just a friendly line and a short reference derived
// from the error digest that support can match to server logs.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ref = (error.digest ?? Math.random().toString(36).slice(2, 8))
    .toString()
    .slice(0, 6)
    .toUpperCase();

  return (
    <html lang="en-AU">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f5f3ee",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: "#1a1a1a",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "384px",
            borderRadius: "16px",
            border: "1px solid #e5e1d8",
            background: "#ffffff",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "14px", color: "#6b6b6b", marginTop: "8px" }}>
            We hit an unexpected error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "20px",
              borderRadius: "8px",
              border: "none",
              background: "#1a1a1a",
              color: "#ffffff",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p style={{ fontSize: "12px", color: "#6b6b6b", marginTop: "24px" }}>
            If it keeps happening, quote reference{" "}
            <span style={{ fontFamily: "monospace" }}>#{ref}</span>
          </p>
        </div>
      </body>
    </html>
  );
}
