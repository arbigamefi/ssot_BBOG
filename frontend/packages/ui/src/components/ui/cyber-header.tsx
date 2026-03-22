import * as React from "react";
import { cn } from "../../lib/utils";

// Exposing the sub-components we used to use in ShellHeader, but directly assembled for the Cyber theme
export interface CyberNavLink {
  id: string;
  label: string;
  href: string;
  colorClass?: string; // used for game variant (e.g. text-purple-400 border-purple-400)
}

export interface CyberHeaderProps extends React.HTMLAttributes<HTMLElement> {
  appName?: string;
  variant?: "default" | "transparent" | "game";
  navLinks?: CyberNavLink[];
  activeRouteId?: string;
  gameNavLinks?: CyberNavLink[];
  backToHubHref?: string;
  actionsNode?: React.ReactNode; 
}

export function CyberHeader({
  appName = "ArbiGameFi",
  variant = "default",
  navLinks = [],
  gameNavLinks = [],
  activeRouteId = "none",
  backToHubHref,
  actionsNode,
  className,
  ...props
}: CyberHeaderProps) {

  if (variant === "transparent") {
    return (
      <header className={cn("fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#050505]/80 backdrop-blur-md", className)} {...props}>
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <div className="text-xl font-bold tracking-tight text-white">{appName}</div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-white/60 md:flex">
              {navLinks.map(link => (
                <a key={link.id} href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {actionsNode}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={cn("sticky top-0 z-40 w-full border-b border-white/5 bg-[#050505]/95 backdrop-blur shadow-[0_4px_30px_rgba(0,0,0,0.8)]", className)} {...props}>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        
        <div className="flex items-center gap-6 md:gap-12 w-full">
          <div className="text-lg font-black tracking-tighter text-white flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-white to-white/40 shadow-[0_0_10px_white]" />
            {appName}
          </div>
          
          {variant === "game" ? (
            <nav className="hidden items-center gap-6 sm:flex flex-1">
              {gameNavLinks.map(link => {
                const isActive = activeRouteId === link.id;
                return (
                  <a 
                    key={link.id} 
                    href={link.href} 
                    className={cn(
                      "transition-colors text-sm font-bold", 
                      isActive ? cn(link.colorClass || "text-white border-white", "border-b-2 pb-1") : "text-white/40 hover:text-white"
                    )}
                  >
                    {link.label}
                  </a>
                );
              })}
              
              {backToHubHref && (
                <div className="hidden sm:block border-l border-white/10 h-6 pl-6 ml-2">
                  <a href={backToHubHref} className="text-white/40 hover:text-white transition-colors text-sm font-bold flex items-center gap-2 h-full uppercase tracking-wider">
                    <span>&larr;</span>
                    <span>Hub</span>
                  </a>
                </div>
              )}
            </nav>
          ) : (
            <nav className="hidden items-center gap-6 sm:flex flex-1">
              {navLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className={cn(
                    "transition-colors text-sm font-bold",
                    activeRouteId === link.id
                      ? "text-white border-b-2 border-white pb-1"
                      : "text-white/40 hover:text-white"
                  )}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 flex-shrink-0">
          {actionsNode}
        </div>
        
      </div>
    </header>
  );
}
