import * as React from "react";
import { cn } from "@ssot/ui";

const DiceDot = () => (
  <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-white rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_8px_rgba(255,255,255,0.8)]" />
);

const DiceFace = ({ type, className }: { type: 1 | 2 | 3 | 4 | 5 | 6; className: string }) => (
  <div
    className={cn(
      "absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-900 border-[3px] border-purple-400/80 rounded-[1.5rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.9),0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center backface-hidden",
      className
    )}
  >
    <div className="grid grid-cols-3 grid-rows-3 gap-2 p-3 w-full h-full">
      {type === 1 && (
        <>
          <div />
          <div />
          <div />
          <div />
          <div className="place-self-center">
            <DiceDot />
          </div>
          <div />
          <div />
          <div />
          <div />
        </>
      )}
      {type === 2 && (
        <>
          <div />
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
          <div />
          <div />
          <div />
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div />
        </>
      )}
      {type === 3 && (
        <>
          <div />
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-center">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div />
        </>
      )}
      {type === 4 && (
        <>
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
          <div />
          <div />
          <div />
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
        </>
      )}
      {type === 5 && (
        <>
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-center">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
        </>
      )}
      {type === 6 && (
        <>
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
          <div className="place-self-start">
            <DiceDot />
          </div>
          <div />
          <div className="place-self-end">
            <DiceDot />
          </div>
        </>
      )}
    </div>
  </div>
);

export function DiceCubeDisplay({
  isPending,
  showResult,
  resultNum
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
}) {
  return (
    <div className="relative mb-24 flex flex-col items-center z-10 scale-90 md:scale-100">
      <div className="absolute -bottom-8 w-48 h-12 bg-purple-500/30 blur-[40px] rounded-[100%] pointer-events-none" />
      <div className="w-40 h-40 relative" style={{ perspective: "1500px" }}>
        <div
          className={cn(
            "w-full h-full relative transition-[transform] duration-[2000ms]",
            isPending
              ? "animate-[dice-roll-3d_1.5s_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
              : "animate-[spin_40s_linear_infinite]"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform:
              !isPending && showResult
                ? `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`
                : "rotateX(-20deg) rotateY(30deg)"
          }}
        >
          <DiceFace type={1} className="[transform:rotateY(0deg)_translateZ(5rem)]" />
          <DiceFace type={6} className="[transform:rotateY(180deg)_translateZ(5rem)]" />
          <DiceFace type={3} className="[transform:rotateY(90deg)_translateZ(5rem)]" />
          <DiceFace type={4} className="[transform:rotateY(-90deg)_translateZ(5rem)]" />
          <DiceFace type={2} className="[transform:rotateX(90deg)_translateZ(5rem)]" />
          <DiceFace type={5} className="[transform:rotateX(-90deg)_translateZ(5rem)]" />
        </div>
      </div>

      {showResult && resultNum !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 mt-10">
          <div className="px-6 py-2 bg-purple-600/90 backdrop-blur-xl border border-purple-400 rounded-full text-white font-mono font-black text-3xl shadow-[0_0_40px_rgba(168,85,247,0.8)] animate-in zoom-in spin-in-12 duration-500">
            {resultNum}
          </div>
        </div>
      )}
    </div>
  );
}
