import { getRequestI18n } from "../../../i18n/request";
import { RouteSkeleton } from "../../../components/RouteSkeleton";

export default async function Loading() {
  const { messages } = await getRequestI18n();
  const label = resolveLabel(messages, "portfolio.overview.loading");
  return <RouteSkeleton label={label} variant="default" />;
}

function resolveLabel(messages: unknown, path: string): string {
  let node: any = messages;
  for (const part of path.split(".")) {
    node = node?.[part];
  }
  return typeof node === "string" ? node : "Loading…";
}
