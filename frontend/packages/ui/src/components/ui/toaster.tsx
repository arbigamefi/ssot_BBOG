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
            "group toast group rounded-2xl border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl p-4 shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_1px_5px_rgba(255,255,255,0.05)] text-white font-sans",
          title: "text-white font-bold text-[15px] mb-1",
          description: "text-white/60 text-[13px] leading-relaxed",
          actionButton:
            "bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-3 py-1.5 transition-colors",
          cancelButton:
            "bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-lg px-3 py-1.5 transition-colors border border-white/5",
          success:
            "group-[.toast]:border-emerald-500/30 group-[.toast]:shadow-[0_0_20px_rgba(16,185,129,0.1),inset_0_1px_5px_rgba(255,255,255,0.05)]",
          error:
            "group-[.toast]:border-rose-500/30 group-[.toast]:shadow-[0_0_20px_rgba(244,63,94,0.1),inset_0_1px_5px_rgba(255,255,255,0.05)]",
          info: "group-[.toast]:border-blue-500/30 group-[.toast]:shadow-[0_0_20px_rgba(59,130,246,0.1),inset_0_1px_5px_rgba(255,255,255,0.05)]",
          warning:
            "group-[.toast]:border-amber-500/30 group-[.toast]:shadow-[0_0_20px_rgba(245,158,11,0.1),inset_0_1px_5px_rgba(255,255,255,0.05)]"
        }
      }}
      {...props}
    />
  );
}
