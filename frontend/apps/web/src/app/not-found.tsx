import Link from "next/link";

import { getRequestI18n } from "../i18n/request";

/**
 * Global 404. Server component so it renders instantly without the client
 * bundle. Pulls copy from i18n so it stays on-brand and translated.
 */
export default async function NotFound() {
  const { messages } = await getRequestI18n();
  const copy = (messages as Record<string, any>).notFound ?? {};

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-mono text-6xl font-bold text-brand">404</p>
      <h1 className="text-2xl font-bold text-fg">{copy.title ?? "Page not found"}</h1>
      <p className="max-w-md text-sm leading-6 text-fg-muted">
        {copy.description ?? "The page you’re looking for doesn’t exist or has moved."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-fg-inverse shadow-glow transition hover:bg-brand-hover"
        >
          {copy.home ?? "Back home"}
        </Link>
        <Link
          href="/casino"
          className="rounded-md border border-border-soft bg-surface-2 px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-3"
        >
          {copy.casino ?? "Browse games"}
        </Link>
      </div>
    </main>
  );
}
