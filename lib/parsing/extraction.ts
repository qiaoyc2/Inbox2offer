import {
  ATS_DOMAINS,
  JOB_BOARD_DOMAINS,
  PLATFORM_NAMES,
  RECRUITING_DISPLAY_SUFFIX,
  domainMatches,
} from "./rules";

export type ParsedSender = {
  displayName: string | null;
  address: string;
  localPart: string;
  domain: string;
};

export type Extraction = { value: string; source: string };

const BRACKETED = /^\s*"?([^"<]*?)"?\s*<([^<>]+)>\s*$/;

export function parseSender(sender: string): ParsedSender {
  const match = BRACKETED.exec(sender);
  const address = (match ? match[2] : sender).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  return {
    displayName: match?.[1]?.trim() || null,
    address,
    localPart: at === -1 ? address : address.slice(0, at),
    domain: at === -1 ? "" : address.slice(at + 1),
  };
}

export function senderPlatform(sender: ParsedSender): { kind: "ats" | "job board"; domain: string } | null {
  const ats = domainMatches(sender.domain, ATS_DOMAINS);
  if (ats) return { kind: "ats", domain: ats };
  const board = domainMatches(sender.domain, JOB_BOARD_DOMAINS);
  if (board) return { kind: "job board", domain: board };
  return null;
}

const TITLE_KEYWORD =
  /\b(?:engineer(?:ing)?|developer|programmer|manager|analyst|scientist|designer|intern(?:ship)?|specialist|consultant|associate|director|lead|architect|administrator|coordinator|representative|technician|researcher|officer|assistant|accountant|recruiter|writer|editor|strategist|sre|devops|vp|president|head of|principal|fellow|teacher|nurse|advisor|counsel|attorney|paralegal|executive|marketer|planner|operator|controller|auditor|economist|statistician|product owner|scrum master|tester)\b/i;

/** Words that make "the ___ position" a reference to a position rather than its title. */
const GENERIC_TITLE_WORDS = new Set([
  "open", "above", "following", "same", "current", "new", "exciting", "available", "advertised",
  "posted", "aforementioned", "mentioned", "applied", "selected", "relevant", "specific", "other",
  "another", "this", "that", "your", "our", "a", "an", "the", "said", "listed", "vacant", "great",
]);

const COMPANY_STOP_WORDS = new Set([
  "for", "at", "with", "to", "from", "in", "on", "regarding", "about", "is", "are", "was", "were",
  "has", "have", "had", "we", "you", "our", "your", "this", "that", "as", "by", "or", "but", "and",
  "who", "which", "where", "via", "today", "-", "|",
]);

const COMPANY_DENY = new Set([
  "us", "team", "company", "organization", "organisation", "hiring", "recruiting", "careers",
  "talent", "hr", "people", "position", "role", "job", "opportunity", "interview", "offer",
  "application", "i", "me", "it", "them", "all", "any", "hi", "hello", "dear", "thank", "thanks",
]);

const COMPANY_CONNECTORS = new Set(["&", "of"]);

const startsUpper = (token: string) => /^[A-Z0-9]/.test(token);
const stripPunctuation = (token: string) =>
  token.replace(/^[("'[]+/, "").replace(/[,.;:!?)"'\]]+$/, "");

function cleanCompany(raw: string[]): string | null {
  const tokens = [...raw];
  while (tokens.length > 0 && COMPANY_CONNECTORS.has(tokens[tokens.length - 1].toLowerCase())) {
    tokens.pop();
  }
  const value = tokens.join(" ").replace(RECRUITING_DISPLAY_SUFFIX, "").trim();
  if (value.length < 2 || value.length > 60) return null;
  const lower = value.toLowerCase();
  if (COMPANY_DENY.has(lower) || PLATFORM_NAMES.has(lower) || /^\d+$/.test(value)) return null;
  // "applying to the Software Engineer role" names a job, not an employer.
  if (TITLE_KEYWORD.test(value)) return null;
  return value;
}

/** The run of capitalized words at the start of `text`, e.g. "Amazon Web Services" in "Amazon Web Services for the …". */
function leadingName(text: string): string | null {
  const tokens = text.split(" ");
  const name: string[] = [];
  for (let i = 0; i < tokens.length && name.length < 5; i += 1) {
    const token = stripPunctuation(tokens[i]);
    if (!token) break;
    const lower = token.toLowerCase();
    if (name.length === 0 && lower === "the") continue;
    if (COMPANY_STOP_WORDS.has(lower)) break;
    if (COMPANY_CONNECTORS.has(lower)) {
      if (name.length === 0) break;
      name.push(token);
    } else if (startsUpper(token)) {
      name.push(token);
    } else {
      break;
    }
    // Trailing punctuation ends the name ("…applying to Amazon. We…").
    if (stripPunctuation(tokens[i]) !== tokens[i].replace(/^[("'[]+/, "")) break;
  }
  return cleanCompany(name);
}

/** The run of capitalized words at the end of `text`, e.g. "Amazon" in "us on the Amazon". */
function trailingName(text: string): string | null {
  const tokens = text.trim().split(" ").map(stripPunctuation).filter(Boolean);
  const name: string[] = [];
  for (let i = tokens.length - 1; i >= 0 && name.length < 5; i -= 1) {
    const token = tokens[i];
    if (COMPANY_CONNECTORS.has(token.toLowerCase()) && name.length > 0) name.unshift(token);
    else if (startsUpper(token) && !COMPANY_STOP_WORDS.has(token.toLowerCase())) name.unshift(token);
    else break;
  }
  if (name[0]?.toLowerCase() === "the") name.shift();
  return cleanCompany(name);
}

const COMPANY_PREFIX_ANCHORS: RegExp[] = [
  /\b(?:applying|applied|application|apply) (?:to|at|with) /gi,
  /\bapplication was sent to /gi,
  /\binterest in (?:joining |working (?:at|with|for) )?/gi,
  /\b(?:position|role|job|opportunity|opening|career|internship|employment) (?:at|with) /gi,
  /\b(?:interview|offer|team) at /gi,
  /\bon behalf of /gi,
  /\bhere at /gi,
];

const COMPANY_ENCLOSED: RegExp[] = [
  /\bjoin(?:ing)? (?:the )?((?:[\w&'.-]+ ){1,4}?)(?:team|family)\b/gi,
];

const COMPANY_SUFFIXED: RegExp[] = [
  /((?:[\w&'.-]+ ){1,4}?)(?:recruiting|recruitment|talent acquisition|talent|hiring|careers|people) team\b/gi,
];

function companyFromText(text: string): Extraction | null {
  for (const anchor of COMPANY_PREFIX_ANCHORS) {
    for (const match of text.matchAll(anchor)) {
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 120);
      const value = leadingName(after);
      if (value) return { value, source: `"${match[0].trim()} ${value}"` };
    }
  }
  for (const pattern of COMPANY_ENCLOSED) {
    for (const match of text.matchAll(pattern)) {
      const value = leadingName(match[1].trim());
      if (value) return { value, source: `"${match[0].trim()}"` };
    }
  }
  for (const pattern of COMPANY_SUFFIXED) {
    for (const match of text.matchAll(pattern)) {
      const value = trailingName(match[1]);
      if (value) return { value, source: `"${match[0].trim()}"` };
    }
  }
  return null;
}

export function extractCompany(subject: string, body: string, sender: ParsedSender): Extraction | null {
  const fromText = companyFromText(subject) ?? companyFromText(body);
  if (fromText) return fromText;

  // Only display names that read like "<Company> Recruiting" are trusted; a bare name may be a person,
  // and ATS or job-board display names belong to the platform rather than the employer.
  const display = sender.displayName;
  if (display && RECRUITING_DISPLAY_SUFFIX.test(display)) {
    const value = cleanCompany(display.replace(RECRUITING_DISPLAY_SUFFIX, "").split(/\s+/));
    if (value) return { value, source: `sender name "${display}"` };
  }
  return null;
}

const TITLE_TOKEN = String.raw`(?:(?!(?:the|a|an|for|to|at|with|from|your|our|this|that|in|on|of the)\b)[\w/&+#.()'-]+ )`;

const TITLE_WITH_ROLE_NOUN = new RegExp(
  String.raw`\b(?:the|our|this|a|an|for|as) (${TITLE_TOKEN}{1,8}?)(?:position|role|opening|vacancy|job)\b(?!s)`,
  "gi",
);

const TITLE_PREFIX_ANCHORS: RegExp[] = [
  /\b(?:applying|applied|application|candidacy|interview(?:ing)?|offer|considered) (?:for|to) (?:the |our |a |an )?/gi,
  /\b(?:position|role) (?:of|as) (?:a |an |the )?/gi,
  /\bas (?:a|an|our) (?:new )?/gi,
];

const TITLE_STOP_WORDS = new Set([
  "at", "with", "for", "from", "to", "on", "in", "we", "you", "has", "have", "is", "was", "which", "that",
  "and", "position", "role", "opening", "job", "here", "-", "|",
]);

const isTitleCase = (tokens: string[]) =>
  tokens.every((token) => startsUpper(token) || ["of", "&", "and", "-", "/"].includes(token));

function cleanTitle(tokens: string[], requireKeyword: boolean): string | null {
  const words = tokens.map(stripPunctuation).filter(Boolean);
  while (words.length > 0 && GENERIC_TITLE_WORDS.has(words[0].toLowerCase())) words.shift();
  if (words.length === 0 || words.length > 8) return null;
  const value = words.join(" ");
  if (value.length < 2 || value.length > 80) return null;
  const hasKeyword = TITLE_KEYWORD.test(value);
  if (requireKeyword ? !hasKeyword : !hasKeyword && !isTitleCase(words)) return null;
  return value;
}

function titleBeforeRoleNoun(text: string): Extraction | null {
  for (const match of text.matchAll(TITLE_WITH_ROLE_NOUN)) {
    const value = cleanTitle(match[1].trim().split(" "), false);
    if (value) return { value, source: `"${match[0].trim()}"` };
  }
  return null;
}

function titleAfterAnchor(text: string): Extraction | null {
  for (const anchor of TITLE_PREFIX_ANCHORS) {
    for (const match of text.matchAll(anchor)) {
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 120);
      const tokens: string[] = [];
      for (const raw of after.split(" ")) {
        const token = stripPunctuation(raw);
        if (!token || TITLE_STOP_WORDS.has(token.toLowerCase())) break;
        tokens.push(token);
        if (token !== raw.replace(/^[("'[]+/, "") || tokens.length >= 8) break;
      }
      const value = cleanTitle(tokens, true);
      if (value) return { value, source: `"${match[0].trim()} ${value}"` };
    }
  }
  return null;
}

/** "Interview Invitation - Data Engineer" → "Data Engineer". */
function titleFromSubjectSegments(subject: string): Extraction | null {
  const segments = subject.split(/\s+[-|]\s+|:\s+/);
  if (segments.length < 2) return null;
  for (const segment of segments) {
    const beforeCompany = segment.split(/\s+(?:at|with)\s+/i)[0];
    const value = cleanTitle(beforeCompany.trim().split(/\s+/), true);
    if (value) return { value, source: `subject segment "${segment.trim()}"` };
  }
  return null;
}

export function extractPosition(subject: string, body: string): Extraction | null {
  return (
    titleBeforeRoleNoun(subject) ??
    titleBeforeRoleNoun(body) ??
    titleFromSubjectSegments(subject) ??
    titleAfterAnchor(subject) ??
    titleAfterAnchor(body)
  );
}
