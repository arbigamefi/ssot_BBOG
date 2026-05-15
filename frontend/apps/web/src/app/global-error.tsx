"use client";

import { useEffect } from "react";

/**
 * Global error boundary — catches errors in the root layout itself.
 * Because the root layout may have crashed (including its <html>/<body>
 * and all Providers), this component must render its own shell and
 * cannot use @ssot/ui components (Tailwind may not be loaded).
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalErrorBoundary]", error);
    (
      window as Window & { __ssotCaptureException?: (error: unknown) => void }
    ).__ssotCaptureException?.(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#0a0a0a",
          color: "#fafafa"
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 32,
            border: "1px solid #333",
            borderRadius: 16,
            textAlign: "center"
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Application Error</h1>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 16 }}>
            {error.message || "A critical error occurred. Please try reloading."}
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#666", fontFamily: "monospace", marginBottom: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "8px 20px",
              border: "1px solid #555",
              borderRadius: 8,
              backgroundColor: "transparent",
              color: "#fafafa",
              cursor: "pointer",
              fontSize: 14
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
