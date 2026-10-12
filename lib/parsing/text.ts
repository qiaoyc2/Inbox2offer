export type EmailSections = {
  /** The newest message written by the sender, without quoted history or signature. */
  current: string;
  signature: string;
  /** Older messages quoted below the newest one. */
  quoted: string;
};

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2012-\u2015\u2212]/g, "-");
}

/** Collapses all whitespace so phrases match across line wraps. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const QUOTE_BOUNDARIES = [
  // Gmail/Apple Mail: "On Mon, Oct 5, 2026 at 9:00 AM Jane <jane@x.com> wrote:" (may wrap once)
  /^[ \t]*On\b[^\n]{0,300}(?:\n[^\n]{0,300})?\bwrote:[ \t]*$/im,
  /^[ \t]*-{2,}[ \t]*Original Message[ \t]*-{2,}/im,
  // Outlook: a "From:" header line followed by "Sent:" or "Date:"
  /^[ \t]*From:[^\n]*\n[ \t]*(?:Sent|Date):/im,
  /^[ \t]*>/m,
];

const FORWARD_MARKER = /^[ \t]*-{2,}[ \t]*Forwarded message[ \t]*-{2,}[ \t]*$/im;
const FORWARD_HEADER_LINE = /^[ \t]*(?:From|Date|Sent|Subject|To|Cc):/i;

// "-- " is the standard signature delimiter; sign-offs are only treated as such on their own line.
const SIGNATURE_DELIMITER = /^-- ?$/m;
const SIGN_OFF =
  /^[ \t]*(?:best|best regards|kind regards|warm regards|regards|sincerely|cheers|thanks|thank you|many thanks|all the best|respectfully)[ \t]*[,.!]?[ \t]*$/gim;
const MOBILE_FOOTER = /^[ \t]*Sent from my [^\n]+$/im;

function firstMatchIndex(text: string, patterns: RegExp[]): number {
  let earliest = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && (earliest === -1 || match.index < earliest)) earliest = match.index;
  }
  return earliest;
}

function splitQuoted(text: string): { current: string; quoted: string } {
  const index = firstMatchIndex(text, QUOTE_BOUNDARIES);
  if (index === -1) return { current: text, quoted: "" };
  return { current: text.slice(0, index), quoted: text.slice(index) };
}

/**
 * Forwarded content is treated as current, since forwarding a recruiter email
 * is how a user would hand it to the app. Only the forward header block is dropped.
 */
function unwrapForward(text: string): string {
  const marker = FORWARD_MARKER.exec(text);
  if (!marker) return text;
  const before = text.slice(0, marker.index);
  const lines = text.slice(marker.index + marker[0].length).split("\n");
  let start = 0;
  while (start < lines.length && (lines[start].trim() === "" || FORWARD_HEADER_LINE.test(lines[start]))) {
    start += 1;
  }
  return `${before}\n${lines.slice(start).join("\n")}`;
}

function splitSignature(text: string): { current: string; signature: string } {
  const candidates: number[] = [];
  for (const pattern of [SIGNATURE_DELIMITER, MOBILE_FOOTER]) {
    const match = pattern.exec(text);
    if (match) candidates.push(match.index);
  }
  // The last sign-off is used because "Thanks!" can also open an email.
  const signOff = [...text.matchAll(SIGN_OFF)].at(-1);
  if (signOff && text.slice(0, signOff.index).trim().length > 0) candidates.push(signOff.index);
  if (candidates.length === 0) return { current: text, signature: "" };
  const index = Math.min(...candidates);
  return { current: text.slice(0, index), signature: text.slice(index) };
}

export function splitEmailSections(body: string): EmailSections {
  const normalized = normalizeText(body);
  const forward = FORWARD_MARKER.exec(normalized);
  const quoteIndex = firstMatchIndex(normalized, QUOTE_BOUNDARIES);
  // The forward header block looks like an Outlook quote header, so unwrap it before splitting.
  const unwrapped =
    forward && (quoteIndex === -1 || forward.index < quoteIndex) ? unwrapForward(normalized) : normalized;
  const { current: withSignature, quoted } = splitQuoted(unwrapped);
  const { current, signature } = splitSignature(withSignature);
  return { current: current.trim(), signature: signature.trim(), quoted: quoted.trim() };
}

const REPLY_OR_FORWARD_PREFIX = /^\s*(?:(?:re|fwd?|aw|sv)\s*:\s*)+/i;

export function isReplyOrForwardSubject(subject: string): boolean {
  return REPLY_OR_FORWARD_PREFIX.test(subject);
}

export function stripSubjectPrefixes(subject: string): string {
  return subject.replace(REPLY_OR_FORWARD_PREFIX, "");
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
