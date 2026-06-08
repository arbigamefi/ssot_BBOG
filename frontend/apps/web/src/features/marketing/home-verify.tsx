import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon
} from "@heroicons/react/24/outline";

/**
 * "Don't trust us. Verify." — the GTM proof beat made tangible. The panel shows
 * a short, faithful excerpt of the on-chain dice odds math (a pure function:
 * deterministic, no hidden house knobs) and links to the actual deployed
 * contract so the displayed snippet is never the source of truth. Source code
 * is not translated; only the surrounding copy is.
 */
const FILENAME = "DiceModule.sol";

const CODE_LINES: readonly string[] = [
  "// DiceModule.sol — 100-sided dice, target in [1..99]",
  "// Roll Over wins if rolled > target; Under wins if rolled <= target.",
  "// Per-roll payout (gross): amountPerRoll * 100 / winCount → up to 100x",
  "",
  "function maxPayout(bytes calldata params, StakeSpec calldata stakeSpec)",
  "    external pure returns (uint256 reserved)",
  "{",
  "    (bool isOver, uint8 target) = DiceParams.decode(params);",
  '    require(target >= 1 && target <= 99, "target");',
  "",
  "    uint256 stake = stakeSpec.amountPerRoll * stakeSpec.betCount;",
  "    uint256 denom = isOver ? (100 - target) : target;",
  "    reserved = Math.mulDiv(stake, 100, denom);",
  "}"
];

const KEYWORDS = new Set([
  "function",
  "external",
  "pure",
  "view",
  "returns",
  "require",
  "internal",
  "override",
  "contract",
  "emit",
  "if",
  "for",
  "return",
  "using",
  "calldata",
  "memory"
]);

const TYPES = new Set(["bool", "uint256", "uint8", "uint32", "bytes", "address", "int256"]);

function CodeLine({ line }: { line: string }) {
  if (line.trim() === "") return <span>{" "}</span>;
  if (line.trimStart().startsWith("//")) {
    return <span className="text-fg-subtle">{line}</span>;
  }
  const tokens = line.match(/([A-Za-z_]\w*|"[^"]*"|\d+|\s+|[^\sA-Za-z0-9"]+)/g) ?? [line];
  return (
    <>
      {tokens.map((token, index) => {
        if (/^"/.test(token)) {
          return (
            <span key={index} className="text-success">
              {token}
            </span>
          );
        }
        if (KEYWORDS.has(token)) {
          return (
            <span key={index} className="text-brand">
              {token}
            </span>
          );
        }
        if (TYPES.has(token) || /^\d+$/.test(token)) {
          return (
            <span key={index} className="text-accent">
              {token}
            </span>
          );
        }
        return (
          <span key={index} className="text-fg-muted">
            {token}
          </span>
        );
      })}
    </>
  );
}

export function HomeVerify({
  copy,
  verifyHref
}: {
  copy: {
    eyebrow: string;
    title: string;
    description: string;
    sourceNote: string;
    verifyCta: string;
    cta: string;
  };
  /** Block explorer URL for the deployed dice module; omit to hide the link. */
  verifyHref?: string;
}) {
  return (
    <section className="border-b border-border-soft bg-surface-0 py-20">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Code panel — a real, verifiable excerpt. */}
          <div className="order-2 overflow-hidden rounded-xl border border-border-soft bg-surface-1 shadow-e3 lg:order-1">
            <div className="flex items-center justify-between border-b border-border-soft bg-surface-2/60 px-4 py-3">
              <div className="flex items-center gap-2" aria-hidden>
                <span className="h-3 w-3 rounded-full bg-danger/70" />
                <span className="h-3 w-3 rounded-full bg-accent/70" />
                <span className="h-3 w-3 rounded-full bg-success/70" />
              </div>
              <span className="font-mono text-xs text-fg-muted">{FILENAME}</span>
            </div>
            <div className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-relaxed">
              <code className="block min-w-max">
                {CODE_LINES.map((line, index) => (
                  <div key={index} className="whitespace-pre">
                    <CodeLine line={line} />
                  </div>
                ))}
              </code>
            </div>
          </div>

          {/* Copy — the "verify" beat. */}
          <div className="order-1 lg:order-2">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
              <CodeBracketIcon className="h-4 w-4" />
              {copy.eyebrow}
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-fg md:text-5xl">{copy.title}</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-fg-muted md:text-lg">
              {copy.description}
            </p>
            <p className="mt-4 max-w-xl text-xs leading-5 text-fg-subtle">{copy.sourceNote}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {verifyHref ? (
                <a
                  href={verifyHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e2 transition-[transform,box-shadow,background-color] hover:bg-brand-hover"
                >
                  {copy.verifyCta}
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              ) : null}
              <Link
                href="/casino"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border-soft bg-surface-2 px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-fg transition-[transform,box-shadow,border-color,background-color] hover:border-brand/40 hover:bg-surface-3"
              >
                {copy.cta}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
