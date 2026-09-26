/**
 * Error text that is safe to log and to publish in the health snapshot.
 *
 * `message` alone is not enough. viem transport errors embed the RPC URL, API
 * key included, in it (`URL: wss://…/v2/<key>`), and Node's WebSocket reports a
 * refused, rejected or dropped connection as an ErrorEvent whose `message` is
 * empty. So this reads the structured fields viem and Node provide (`name`,
 * `shortMessage`, `details`, `code`, `status`, `cause`) and then redacts any URL
 * that is left.
 */

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CAUSE_DEPTH = 5;
// Any scheme, so credentials in a database URL go too; trailing punctuation stays in the text.
const URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>\\]*[^\s"'`<>\\.,;:!?)\]}]/gi;

export function redactUrls(text: string) {
  return text.replace(URL_PATTERN, "[redacted-url]");
}

/** One line such as `HttpRequestError [status=429]: HTTP request failed. Details: …`. Never throws. */
export function describeError(error: unknown): string {
  try {
    const text = redactUrls(describeWithRootCause(error)).replace(/\s+/g, " ").trim();
    return text.length > MAX_DESCRIPTION_LENGTH
      ? `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`
      : text;
  } catch {
    return "(error could not be described)";
  }
}

type Fields = Record<string, unknown>;

function isObject(value: unknown): value is Fields {
  return typeof value === "object" && value !== null;
}

function stringField(value: Fields, key: string) {
  const field = value[key];
  return typeof field === "string" && field.trim().length > 0 ? field : undefined;
}

/** DOM-style events (the WebSocket ErrorEvent) have a `type` and a `timeStamp`, not a `name`. */
function isEvent(value: Fields) {
  return typeof value.type === "string" && typeof value.timeStamp === "number";
}

function nameOf(value: Fields) {
  const name = stringField(value, "name");
  if (name) return name;
  const constructorName = (value.constructor as { name?: unknown } | undefined)?.name;
  return typeof constructorName === "string" && constructorName && constructorName !== "Object"
    ? constructorName
    : "Error";
}

/** viem's `shortMessage` leaves out the URL and request body that its `message` carries. */
function textOf(value: unknown) {
  if (typeof value === "string") return value.trim() || undefined;
  if (!isObject(value)) return undefined;
  return stringField(value, "shortMessage") ?? stringField(value, "message");
}

function tagsOf(value: unknown) {
  if (!isObject(value)) return [];
  const tags: string[] = [];
  if (typeof value.code === "string" || typeof value.code === "number") {
    tags.push(`code=${value.code}`);
  }
  if (typeof value.status === "number") tags.push(`status=${value.status}`);
  return tags;
}

function describeOne(value: unknown) {
  if (!isObject(value)) {
    if (typeof value === "string") return value.trim() || "(empty string)";
    return String(value);
  }
  const tags = tagsOf(value);
  const text =
    textOf(value) ??
    (isEvent(value) ? `${String(value.type)} event without a message` : "(no message)");
  let line = `${nameOf(value)}${tags.length > 0 ? ` [${tags.join(", ")}]` : ""}: ${text}`;
  const details = stringField(value, "details");
  if (details && !line.includes(details)) line += ` Details: ${details}`;
  return line;
}

function causeOf(value: unknown) {
  if (!isObject(value)) return undefined;
  if (value.cause != null) return value.cause;
  return isEvent(value) && value.error != null ? value.error : undefined;
}

function rootCauseOf(error: unknown) {
  let current = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    const next = causeOf(current);
    if (next === undefined || next === current) break;
    current = next;
  }
  return current;
}

/**
 * viem already folds a cause's text into `details`, so the chain is not
 * repeated. The root cause is added only when it says something new, as the
 * network error under `fetch failed` does.
 */
function describeWithRootCause(error: unknown) {
  const line = describeOne(error);
  const root = rootCauseOf(error);
  if (root === error) return line;
  const facts = [textOf(root), ...tagsOf(root)].filter((fact): fact is string => Boolean(fact));
  return facts.some((fact) => !line.includes(fact)) ? `${line} <- ${describeOne(root)}` : line;
}
