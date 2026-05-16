"use client";

import * as React from "react";

import { cn } from "../../lib/utils";

type ToastId = string | number;
type ToastTone = "success" | "error" | "warning" | "info" | "loading";

type ToastOptions = {
  description?: React.ReactNode;
  duration?: number;
  id?: ToastId;
};

type ToastRecord = ToastOptions & {
  id: ToastId;
  message: string;
  tone: ToastTone;
};

type ToastEventDetail =
  | ({ type: "show" } & ToastRecord)
  | {
      id?: ToastId;
      type: "dismiss";
    };

export type ToasterProps = {
  className?: string;
};

const TOAST_EVENT = "ssot-ui-toast";
const DEFAULT_DURATION_MS = 4_000;

let toastSequence = 0;

function nextToastId(): string {
  toastSequence += 1;
  return `ssot-toast-${Date.now()}-${toastSequence}`;
}

function emitToast(detail: ToastEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastEventDetail>(TOAST_EVENT, { detail }));
}

function showToast(tone: ToastTone, message: string, options?: ToastOptions): ToastId {
  const id = options?.id ?? nextToastId();
  emitToast({ ...options, id, message, tone, type: "show" });
  return id;
}

export const toast = {
  dismiss(id?: ToastId) {
    emitToast({ id, type: "dismiss" });
  },
  error(message: string, options?: ToastOptions) {
    return showToast("error", message, options);
  },
  info(message: string, options?: ToastOptions) {
    return showToast("info", message, options);
  },
  loading(message: string, options?: ToastOptions) {
    return showToast("loading", message, options);
  },
  success(message: string, options?: ToastOptions) {
    return showToast("success", message, options);
  },
  warning(message: string, options?: ToastOptions) {
    return showToast("warning", message, options);
  }
};

const toneClassName: Record<ToastTone, string> = {
  error: "border-danger/35",
  info: "border-info/35",
  loading: "border-border",
  success: "border-success/35",
  warning: "border-warn/35"
};

function removeToast(toasts: ToastRecord[], id?: ToastId) {
  if (id === undefined) return [];
  return toasts.filter((toastItem) => toastItem.id !== id);
}

export function Toaster({ className }: ToasterProps) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();

    window.addEventListener(
      TOAST_EVENT,
      (event) => {
        const detail = (event as CustomEvent<ToastEventDetail>).detail;
        if (detail.type === "dismiss") {
          setToasts((current) => removeToast(current, detail.id));
          return;
        }

        setToasts((current) => {
          const next = current.filter((toastItem) => toastItem.id !== detail.id);
          return [...next, detail].slice(-4);
        });

        if (detail.tone !== "loading") {
          window.setTimeout(() => {
            setToasts((current) => removeToast(current, detail.id));
          }, detail.duration ?? DEFAULT_DURATION_MS);
        }
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  }, []);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3",
        className
      )}
    >
      {toasts.map((toastItem) => (
        <div
          key={toastItem.id}
          className={cn(
            "pointer-events-auto rounded-lg border bg-surface-1 p-4 font-sans text-fg shadow-e3 backdrop-blur-xl",
            toneClassName[toastItem.tone]
          )}
        >
          <div className="text-[15px] font-bold text-fg">{toastItem.message}</div>
          {toastItem.description ? (
            <div className="mt-1 text-[13px] leading-relaxed text-fg-muted">
              {toastItem.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
