"use client";

import { useEffect, useState } from "react";

const token = (name: string, fallback: string) => `hsl(var(${name}, ${fallback}))`;

const GLOBAL_ERROR_COPY = {
  en: {
    lang: "en",
    title: "Application Error",
    fallback: "A critical error occurred. Please try reloading.",
    errorId: (digest: string) => `Error ID: ${digest}`,
    tryAgain: "Try again"
  },
  zhHans: {
    lang: "zh-Hans",
    title: "应用发生错误",
    fallback: "发生严重错误。请尝试重新加载页面。",
    errorId: (digest: string) => `错误 ID: ${digest}`,
    tryAgain: "重试"
  }
};

function getBrowserGlobalErrorCopy() {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return GLOBAL_ERROR_COPY.zhHans;
  }
  return GLOBAL_ERROR_COPY.en;
}

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
  const [copy, setCopy] = useState(GLOBAL_ERROR_COPY.en);

  useEffect(() => {
    setCopy(getBrowserGlobalErrorCopy());
    console.error("[GlobalErrorBoundary]", error);
    (
      window as Window & { __ssotCaptureException?: (error: unknown) => void }
    ).__ssotCaptureException?.(error);
  }, [error]);

  return (
    <html lang={copy.lang}>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: token("--surface-0", "220 39% 4%"),
          color: token("--fg", "210 40% 98%")
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 32,
            border: `1px solid ${token("--border", "220 20% 18%")}`,
            borderRadius: 16,
            textAlign: "center"
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>{copy.title}</h1>
          <p style={{ fontSize: 14, color: token("--fg-muted", "215 16% 65%"), marginBottom: 16 }}>
            {copy.fallback}
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: token("--fg-subtle", "215 14% 58%"),
                fontFamily: "monospace",
                marginBottom: 16
              }}
            >
              {copy.errorId(error.digest)}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "8px 20px",
              border: `1px solid ${token("--border", "220 20% 18%")}`,
              borderRadius: 8,
              backgroundColor: "transparent",
              color: token("--fg", "210 40% 98%"),
              cursor: "pointer",
              fontSize: 14
            }}
          >
            {copy.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
