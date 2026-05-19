import * as React from "react";
import { cn } from "@ssot/ui";

const DiceDot = () => (
  <div className="h-2.5 w-2.5 rounded-full bg-fg shadow-e1 md:h-3.5 md:w-3.5" />
);

const DiceFace = ({ type, className }: { type: 1 | 2 | 3 | 4 | 5 | 6; className: string }) => (
  <div
    className={cn(
      "absolute inset-0 flex items-center justify-center rounded-lg border-[3px] border-brand/45 bg-gradient-to-br from-brand/80 to-accent/35 shadow-e3 backface-hidden",
      className
    )}
  >
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-2 p-3">
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
  const settledRotation =
    resultNum == null
      ? null
      : {
          x: 40 + resultNum * 47,
          y: 20 + resultNum * 83
        };

  return (
    <div className="relative z-10 flex flex-col items-center scale-90 md:scale-100">
      <div className="absolute -bottom-8 h-12 w-48 rounded-full bg-brand/25 blur-[40px] pointer-events-none" />
      <div className="relative h-40 w-40" style={{ perspective: "1500px" }}>
        <div
          className={cn(
            "relative h-full w-full transition-[transform] duration-[2000ms]",
            isPending
              ? "animate-[dice-roll-3d_1.5s_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
              : "animate-[spin_40s_linear_infinite]"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform:
              !isPending && showResult && settledRotation
                ? `rotateX(${settledRotation.x}deg) rotateY(${settledRotation.y}deg)`
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

      {showResult && !isPending && resultNum !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 mt-10">
          <div className="rounded-full border border-brand/40 bg-brand px-6 py-2 font-mono text-3xl font-semibold text-fg-inverse shadow-e2 backdrop-blur-xl animate-in zoom-in spin-in-12 duration-500">
            {resultNum}
          </div>
        </div>
      )}
    </div>
  );
}
