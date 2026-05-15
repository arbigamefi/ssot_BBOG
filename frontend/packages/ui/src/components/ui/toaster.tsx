"use client";

import * as React from "react";
import { Toaster as SonnerToaster } from "sonner";

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-lg border border-border bg-surface-1 p-4 font-sans text-fg shadow-e3 backdrop-blur-xl",
          title: "mb-1 text-[15px] font-bold text-fg",
          description: "text-[13px] leading-relaxed text-fg-muted",
          actionButton:
            "rounded-md bg-brand px-3 py-1.5 font-medium text-fg-inverse transition-colors hover:bg-brand-hover",
          cancelButton:
            "rounded-md border border-border bg-surface-2 px-3 py-1.5 font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg",
          success: "group-[.toast]:border-success/35",
          error: "group-[.toast]:border-danger/35",
          info: "group-[.toast]:border-info/35",
          warning: "group-[.toast]:border-warn/35"
        }
      }}
      {...props}
    />
  );
}
