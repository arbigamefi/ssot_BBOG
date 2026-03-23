import * as React from "react";
import { cn } from "../../lib/utils";

export interface CyberLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  headerNode?: React.ReactNode;
  footerNode?: React.ReactNode;
  selectionColorClass?: string;
  disableContainer?: boolean;
}

export function CyberLayout({
  children,
  headerNode,
  footerNode,
  selectionColorClass = "selection:bg-green-500/30",
  disableContainer = false,
  className,
  ...props
}: CyberLayoutProps) {
  return (
    <div 
      className={cn(
        "min-h-screen bg-[#050505] text-white font-sans flex flex-col overflow-x-hidden",
        selectionColorClass
      )}
      {...props}
    >
      {/* Absolute Ambient Background Layer, typical for SSOT */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      {headerNode && (
        <div className="relative z-50">
          {headerNode}
        </div>
      )}

      <main className={cn(
        "flex-1 relative z-10 w-full",
        !disableContainer && "max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 pb-24",
        className
      )}>
        {children}
      </main>

      {footerNode && (
        <div className="relative z-40 mt-auto">
          {footerNode}
        </div>
      )}
    </div>
  );
}
