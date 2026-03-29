"use client";

import * as React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "../../lib/utils";

export interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

const MAX_WIDTH_MAP = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl"
};

export function GlassModal({
  isOpen,
  onClose,
  title,
  children,
  className,
  maxWidth = "md"
}: GlassModalProps) {
  // Prevent body scrolling when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a]/80 shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_1px_10px_rgba(255,255,255,0.05)] backdrop-blur-xl",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300",
          MAX_WIDTH_MAP[maxWidth],
          className
        )}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Ambient background glow */}
        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none opacity-50" />

        <div className="relative z-10 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div className="text-xl font-bold tracking-tight text-white">{title}</div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-white/40 transition-colors hover:text-white hover:bg-white/5 rounded-full"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto hide-scrollbar custom-scrollbar">{children}</div>
        </div>
      </div>
    </div>
  );
}
