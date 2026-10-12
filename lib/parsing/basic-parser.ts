import {
  MAX_EVIDENCE_ITEMS,
  MAX_EVIDENCE_LENGTH,
  RECRUITING_CLASSIFICATIONS,
  dispositionNeedsReview,
  emailParserInputSchema,
  parseResultSchema,
  type EmailClassification,
  type EmailDisposition,
  type EmailParser,
  type EmailParserInput,
  type ParseResult,
  type RecruitingClassification,
} from "./contract";
import { extractCompany, extractPosition, parseSender, senderPlatform } from "./extraction";
import {
  CONDITIONAL_CUE,
  CONTEXT_RULES,
  NEGATION_CUE,
  PRIOR_INTERVIEW,
  PROMO_RULES,
  RECRUITING_DISPLAY_SUFFIX,
  RECRUITING_MAILBOX,
  SIGNAL_RULES,
  type SignalRule,
} from "./rules";
import {
  collapseWhitespace,
  isReplyOrForwardSubject,
  normalizeText,
  splitEmailSections,
  stripSubjectPrefixes,
  truncate,
} from "./text";

export const BASIC_PARSER_VERSION = "basic-1.0.0";

/** Minimum heuristic confidence for JOB_RELATED. Below it, a recruiting classification is kept but flagged for review. */
export const JOB_RELATED_THRESHOLD = 0.7;

const OUTCOMES: RecruitingClassification[] = ["OFFER", "REJECTION", "INTERVIEW"];
// Actionable events outrank acknowledgments: an interview invite that also confirms receipt is an INTERVIEW.
const PRECEDENCE_TIERS: RecruitingClassification[][] = [
  OUTCOMES,
  ["ADDITIONAL_INFORMATION_REQUEST"],
  ["APPLICATION_CONFIRMATION"],
];
// These phrases also appear in non-recruiting mail (credit card applications, appointment requests).
const NEEDS_CORROBORATION = new Set<RecruitingClassification>([
  "APPLICATION_CONFIRMATION",
  "ADDITIONAL_INFORMATION_REQUEST",
]);
const NON_CORROBORATING_CONTEXT = new Set(["your application", "applied"]);

const NEGATION_WINDOW_WORDS = 6;
const SNIPPET_LENGTH = 100;
const PARAGRAPH = " ¶ ";

type Location = "subject" | "body" | "reply subject" | "quoted history" | "signature";

type SignalMatch = { rule: SignalRule; location: Location; phrase: string; start: number; end: number };
type DiscardedMatch = SignalMatch & { reason: "negated" | "conditional" };

/** Collapses whitespace but keeps paragraph breaks as sentence boundaries for negation checks. */
function toAnalysisText(text: string): string {
  return collapseWhitespace(normalizeText(text).replace(/\n[ \t]*\n/g, PARAGRAPH));
}

function precedingSentence(text: string, index: number): string {
  const before = text.slice(0, index);
  const boundary = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
    before.lastIndexOf(";"),
    before.lastIndexOf("¶"),
  );
  return before.slice(boundary + 1);
}

function scanSignals(text: string, location: Location) {
  const accepted: SignalMatch[] = [];
  const discarded: DiscardedMatch[] = [];
  if (!text) return { accepted, discarded };

  for (const rule of SIGNAL_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      // Overlapping rules for the same event describe one phrase, not corroborating evidence.
      const overlaps = [...accepted, ...discarded].some(
        (other) => other.rule.classification === rule.classification && start < other.end && other.start < end,
      );
      if (overlaps) continue;
      const found = { rule, location, phrase: truncate(match[0], SNIPPET_LENGTH), start, end };
      const sentence = precedingSentence(text, start);
      const nearby = sentence.trim().split(" ").slice(-NEGATION_WINDOW_WORDS).join(" ");
      if (rule.negatable && NEGATION_CUE.test(nearby)) {
        discarded.push({ ...found, reason: "negated" });
      } else if (CONDITIONAL_CUE.test(sentence.replace(/\bonce again\b/gi, ""))) {
        discarded.push({ ...found, reason: "conditional" });
      } else {
        accepted.push(found);
        break;
      }
    }
  }
  return { accepted, discarded };
}

function groupByClassification(matches: SignalMatch[]) {
  const groups = new Map<RecruitingClassification, SignalMatch[]>();
  for (const classification of RECRUITING_CLASSIFICATIONS) {
    const found = matches.filter((match) => match.rule.classification === classification);
    if (found.length > 0) groups.set(classification, found);
  }
  return groups;
}

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number) => Math.min(0.95, Math.max(0.05, value));
const signed = (value: number) => (value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2));

function analyze(input: EmailParserInput): ParseResult {
  const evidence: string[] = [];

  const sender = parseSender(input.sender);
  const rawSubject = collapseWhitespace(normalizeText(input.subject));
  const isReply = isReplyOrForwardSubject(rawSubject);
  const subject = collapseWhitespace(stripSubjectPrefixes(rawSubject));
  const sections = splitEmailSections(input.body);
  const body = toAnalysisText(sections.current);
  const signature = toAnalysisText(sections.signature);
  const quoted = toAnalysisText(sections.quoted);

  const subjectScan = scanSignals(subject, isReply ? "reply subject" : "subject");
  const bodyScan = scanSignals(body, "body");
  const quotedScan = scanSignals(quoted, "quoted history");
  const signatureScan = scanSignals(signature, "signature");

  // Only the newest message decides the outcome. A reply subject ("Re: Interview Invitation")
  // describes the thread, not this message, so it is background like quoted history.
  const current = [...(isReply ? [] : subjectScan.accepted), ...bodyScan.accepted];
  const background = [
    ...(isReply ? subjectScan.accepted : []),
    ...quotedScan.accepted,
    ...signatureScan.accepted,
  ];
  const discarded = [
    ...subjectScan.discarded,
    ...bodyScan.discarded,
    ...quotedScan.discarded,
    ...signatureScan.discarded,
  ];

  const contextText = [subject, body, signature].join(PARAGRAPH);
  const context = CONTEXT_RULES.filter((rule) => rule.pattern.test(contextText));
  const promos = PROMO_RULES.filter((rule) => rule.pattern.test(contextText));
  const conflictingPromos = promos.filter((rule) => rule.conflictsWithRecruiting);

  const platform = senderPlatform(sender);
  const recruitingSender =
    platform?.kind === "ats" ||
    (platform?.kind !== "job board" &&
      (RECRUITING_MAILBOX.test(sender.localPart) ||
        (!!sender.displayName && RECRUITING_DISPLAY_SUFFIX.test(sender.displayName))));
  const corroborated =
    recruitingSender ||
    platform !== null ||
    context.some((rule) => !NON_CORROBORATING_CONTEXT.has(rule.id));

  // Resolve the primary classification.
  const groups = groupByClassification(current);
  const hasStrong = (classification: RecruitingClassification) =>
    groups.get(classification)?.some((match) => match.rule.strength === "strong") ?? false;
  const tiers = [
    ...PRECEDENCE_TIERS.map((tier) => tier.filter(hasStrong)),
    ...PRECEDENCE_TIERS.map((tier) => tier.filter((c) => groups.has(c) && !hasStrong(c))),
  ];
  const winningTier = tiers.find((tier) => tier.length > 0) ?? [];
  const conflict = winningTier.length > 1;
  const primary: RecruitingClassification | null = winningTier.length === 1 ? winningTier[0] : null;
  const secondarySignals = [...groups.keys()].filter((c) => c !== primary);

  let classification: EmailClassification;
  let disposition: EmailDisposition;
  let confidence: number;
  const reasons: string[] = [];

  if (primary) {
    const matches = groups.get(primary)!;
    const strong = hasStrong(primary);
    const otherOutcomes = OUTCOMES.filter((c) => c !== primary && groups.has(c));
    const parts: [string, number][] = [[strong ? "strong phrase" : "supporting phrase only", strong ? 0.7 : 0.5]];
    if (new Set(matches.map((m) => m.rule.id)).size >= 2) parts.push(["multiple phrases", 0.05]);
    if (matches.some((m) => m.location === "subject") && matches.some((m) => m.location === "body")) {
      parts.push(["subject and body agree", 0.05]);
    }
    if (context.length > 0) parts.push(["recruiting context", 0.05]);
    if (recruitingSender) parts.push(["recruiting sender", 0.05]);
    if (otherOutcomes.length > 0) parts.push([`weaker ${otherOutcomes.join("/")} hints`, -0.1]);
    if (conflictingPromos.length > 0) parts.push(["promotional language", -0.15]);
    confidence = round(clamp(parts.reduce((sum, [, value]) => sum + value, 0)));
    evidence.push(
      `Confidence ${confidence.toFixed(2)} (heuristic): ${parts.map(([label, value]) => `${label} ${signed(value)}`).join(", ")}`,
    );

    classification = primary;
    if (confidence < JOB_RELATED_THRESHOLD) reasons.push(`confidence below ${JOB_RELATED_THRESHOLD.toFixed(2)}`);
    if (NEEDS_CORROBORATION.has(primary) && !corroborated) {
      reasons.push("no recruiting context beyond the phrase itself");
    }
    if (conflictingPromos.length > 0) reasons.push("promotional language mixed with recruiting phrases");
    disposition = reasons.length === 0 ? "JOB_RELATED" : "NEEDS_REVIEW";
  } else if (conflict) {
    classification = "UNKNOWN";
    disposition = "NEEDS_REVIEW";
    confidence = 0.3;
    reasons.push(`conflicting current outcomes: ${winningTier.join(", ")}`);
  } else {
    const recruitingPhraseSeen = background.length > 0 || discarded.length > 0;
    const strongContext = recruitingSender || context.some((rule) => rule.strong);
    const strongPromos = promos.filter((rule) => rule.strong);
    // IGNORED needs positive evidence of non-recruiting mail and no recruiting hint anywhere,
    // including quoted history and negated phrases. The sender domain is never enough on its own.
    if (!recruitingPhraseSeen && !strongContext && strongPromos.length >= 1 && promos.length >= 2) {
      classification = "UNRELATED";
      disposition = "IGNORED";
      confidence = round(Math.min(0.9, 0.55 + 0.1 * (promos.length - 1)));
      reasons.push(`${promos.length} promotional or non-recruiting signals and no recruiting evidence`);
    } else {
      classification = "UNKNOWN";
      disposition = "NEEDS_REVIEW";
      confidence = recruitingPhraseSeen || strongContext || corroborated ? 0.3 : 0.2;
      reasons.push(
        recruitingPhraseSeen || strongContext || corroborated
          ? "recruiting hints but no clear current recruiting event"
          : "insufficient evidence to classify",
      );
    }
  }

  const company = extractCompany(subject, body, sender);
  const position = extractPosition(subject, body);
  evidence.unshift(
    `${classification} → ${disposition}${reasons.length > 0 ? `: ${reasons.join("; ")}` : ""}`,
  );
  evidence.push(company ? `Company "${company.value}" from ${company.source}` : "Company not identified");
  evidence.push(position ? `Position "${position.value}" from ${position.source}` : "Position not identified");

  for (const match of current) {
    evidence.push(`${match.rule.classification} in ${match.location} (${match.rule.strength}): "${match.phrase}"`);
  }
  if (secondarySignals.length > 0 && primary) {
    evidence.push(`Secondary signals: ${secondarySignals.join(", ")}`);
  }
  for (const match of discarded) {
    evidence.push(`Ignored ${match.reason} ${match.rule.classification} phrase in ${match.location}: "${match.phrase}"`);
  }
  for (const match of background) {
    evidence.push(
      `${match.location} mentions ${match.rule.classification}: "${match.phrase}" (not used as the current outcome)`,
    );
  }
  const priorInterview = PRIOR_INTERVIEW.exec(body);
  if (priorInterview) evidence.push(`References a prior interview: "${priorInterview[0]}"`);
  if (context.length > 0) evidence.push(`Recruiting context: ${context.map((rule) => rule.id).join(", ")}`);
  if (platform) {
    evidence.push(
      `Sender is ${platform.kind === "ats" ? "an applicant tracking system" : "a job board"} (${platform.domain}); it is not treated as the employer`,
    );
  } else if (recruitingSender) {
    evidence.push(`Sender looks like a recruiting address: ${sender.displayName ?? sender.address}`);
  }
  if (promos.length > 0) evidence.push(`Promotional signals: ${promos.map((rule) => rule.id).join(", ")}`);

  return {
    classification,
    disposition,
    company: company?.value ?? null,
    position: position?.value ?? null,
    confidence,
    needsReview: dispositionNeedsReview(disposition),
    parserType: "RULE_BASED",
    parserVersion: BASIC_PARSER_VERSION,
    evidence: evidence.slice(0, MAX_EVIDENCE_ITEMS).map((line) => truncate(line, MAX_EVIDENCE_LENGTH)),
    secondarySignals,
  };
}

/** Deterministic, rule-based parser. Needs no network access or API key. */
export class BasicEmailParser implements EmailParser {
  async parse(email: EmailParserInput): Promise<ParseResult> {
    return parseResultSchema.parse(analyze(emailParserInputSchema.parse(email)));
  }
}
