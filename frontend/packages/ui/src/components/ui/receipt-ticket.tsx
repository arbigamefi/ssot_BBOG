import * as React from "react";
import { cn } from "../../lib/utils";

export interface ReceiptTicketProps {
  gameName: string;
  ticketId: string;
  status?: "verified" | "pending" | "failed";
  capitalAtRisk: React.ReactNode;
  grossSettlement: React.ReactNode;
  isWin: boolean;
  logicParams: Array<{ label: string; value: React.ReactNode }>;
  truthMatrix: Array<{ label: string; value: React.ReactNode; isHighlight?: boolean; href?: string }>;
  onVerify?: () => void;
  onShare?: () => void;
  className?: string;
}

export function ReceiptTicket({
  gameName,
  ticketId,
  status = "verified",
  capitalAtRisk,
  grossSettlement,
  isWin,
  logicParams,
  truthMatrix,
  onVerify,
  onShare,
  className
}: ReceiptTicketProps) {
  
  const StatusConfig = {
    verified: {
      color: "bg-green-500",
      shadow: "shadow-[0_0_10px_rgba(34,197,94,0.8)]",
      text: "text-green-500/70",
      label: "Network Verified"
    },
    pending: {
      color: "bg-amber-500",
      shadow: "shadow-[0_0_10px_rgba(245,158,11,0.8)]",
      text: "text-amber-500/70",
      label: "Awaiting Oracle"
    },
    failed: {
      color: "bg-rose-500",
      shadow: "shadow-[0_0_10px_rgba(244,63,94,0.8)]",
      text: "text-rose-500/70",
      label: "Execution Failed"
    }
  }[status];

  return (
    <div className={cn("w-full max-w-4xl mx-auto flex flex-col", className)}>
      {/* Header */}
      <div className="flex flex-col items-center justify-center border-b border-white/10 pb-10 mb-10 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <span className={cn("w-2 h-2 rounded-full animate-[pulse_2s_infinite]", StatusConfig.color, StatusConfig.shadow)} />
          <span className={cn("text-[10px] font-bold font-mono uppercase tracking-[0.3em]", StatusConfig.text)}>
            {StatusConfig.label}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] tracking-tight">
          {gameName}
        </h1>
        <span className="text-white/40 font-mono text-sm tracking-widest bg-[#050505] border border-white/10 px-4 py-1.5 rounded-lg shadow-inner">
          {ticketId}
        </span>
      </div>

      {/* Core Figures */}
      <div className="grid grid-cols-2 gap-6 mb-10 relative z-10">
        <div className="bg-[#050505] p-6 rounded-[2rem] border border-white/5 shadow-inner flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">Capital At Risk</span>
          <span className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
            {capitalAtRisk}
          </span>
        </div>
        
        <div className={cn(
          "p-6 rounded-[2rem] border-2 shadow-inner flex flex-col justify-center relative overflow-hidden group",
          isWin ? "bg-[#020502] border-green-500/20 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]" : "bg-[#050202] border-rose-500/20 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]"
        )}>
          <div className={cn(
            "absolute top-0 right-0 w-24 h-24 blur-[30px] transition-colors",
            isWin ? "bg-green-500/10 group-hover:bg-green-500/20" : "bg-rose-500/10 group-hover:bg-rose-500/20"
          )} />
          <div className={cn(
            "absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent",
            isWin ? "via-green-500/50" : "via-rose-500/50"
          )} />
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest mb-2",
            isWin ? "text-green-500/60" : "text-rose-500/60"
          )}>Gross Settlement</span>
          <span className={cn(
            "text-3xl font-mono font-bold drop-shadow-md",
            isWin ? "text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]"
          )}>
            {grossSettlement}
          </span>
        </div>
      </div>

      {/* Parameters & Truth Matrix - Cyber Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 border border-white/5 bg-[#080808] p-8 rounded-[2rem]">
        {/* Logic Params */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
            <div className="w-1 h-1 bg-white/40 rounded-full" /> Execution Logic
          </h3>
          <div className="flex flex-col font-mono text-sm gap-1">
            {logicParams.map((param, i) => (
              <div key={i} className={cn(
                "flex justify-between py-3 border-white/5 bg-white/[0.01] px-3 hover:bg-white/[0.03] transition-colors",
                i === 0 && "rounded-t-xl",
                i === logicParams.length - 1 ? "rounded-b-xl" : "border-b"
              )}>
                <span className="text-white/40 uppercase text-[10px] tracking-widest mt-0.5">{param.label}</span>
                <span className="text-white font-bold">{param.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Truth Matrix */}
        <div className="flex flex-col gap-4">
          <h3 className={cn(
            "text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2",
            isWin ? "text-green-400/60" : "text-rose-400/60"
          )}>
            <div className={cn(
              "w-1 h-1 rounded-full shadow-sm",
              isWin ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)]" : "bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,1)]"
            )} /> 
            Provable Truth
          </h3>
          <div className="flex flex-col font-mono text-sm gap-1">
            {truthMatrix.map((item, i) => {
              const highlightColor = isWin ? "text-green-400" : "text-rose-400";
              const highlightShadow = isWin ? "drop-shadow-[0_0_5px_rgba(34,197,94,0.3)]" : "drop-shadow-[0_0_5px_rgba(244,63,94,0.3)]";
              const highlightBorder = isWin ? "border-l-green-500/50 bg-green-500/[0.02]" : "border-l-rose-500/50 bg-rose-500/[0.02]";
              const highlightLabelColor = isWin ? "text-green-500/50" : "text-rose-500/50";
              
              return (
                <div key={i} className={cn(
                  "flex justify-between py-3 border-white/5 px-3 transition-colors",
                  item.isHighlight ? `border-l-[3px] ${highlightBorder}` : "bg-white/[0.01] hover:bg-white/[0.03]",
                  i === 0 && "rounded-t-xl",
                  i === truthMatrix.length - 1 ? "rounded-b-xl" : "border-b"
                )}>
                  <span className={cn(
                    "uppercase text-[10px] tracking-widest mt-0.5",
                    item.isHighlight ? highlightLabelColor : "text-white/40"
                  )}>{item.label}</span>
                  
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer truncate max-w-[120px]">
                      {item.value}
                    </a>
                  ) : (
                    <span className={cn(
                      "font-bold",
                      item.isHighlight ? `${highlightColor} ${highlightShadow}` : "text-white"
                    )}>{item.value}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Share/Verify Actions */}
      <div className="mt-10 flex flex-col sm:flex-row gap-4 relative z-10 w-full mb-10">
        {onVerify && (
          <button 
            onClick={onVerify}
            className="flex-1 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors uppercase tracking-widest text-[10px] shadow-inner border border-white/5"
          >
            Verify Source
          </button>
        )}
        {onShare && (
          <button 
            onClick={onShare}
            className="flex-1 py-4 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 font-bold transition-colors uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]"
          >
            Share Triumph
          </button>
        )}
      </div>
    </div>
  );
}
