import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { SectionEyebrow } from "./section-eyebrow";

export function SectionHeader({
  eyebrow,
  title,
  detail,
  actionHref,
  actionLabel
}: {
  eyebrow: string;
  title: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <SectionEyebrow className="mb-5">{eyebrow}</SectionEyebrow>
        <h2 className="text-4xl font-bold tracking-normal text-fg md:text-5xl">{title}</h2>
        <p className="mt-4 text-base leading-7 text-fg-muted">{detail}</p>
      </div>
      <Link
        href={actionHref}
        className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-surface-1 px-4 py-3 text-sm font-bold text-fg transition hover:bg-surface-2"
      >
        {actionLabel} <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
