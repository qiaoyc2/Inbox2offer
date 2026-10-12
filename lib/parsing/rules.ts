import type { RecruitingClassification } from "./contract";

export type SignalStrength = "strong" | "supporting";

export type SignalRule = {
  id: string;
  classification: RecruitingClassification;
  strength: SignalStrength;
  pattern: RegExp;
  /**
   * Positive statements ("we'd like to schedule an interview") are discarded when negated
   * ("we are not able to schedule an interview"). Rejection phrases already contain the negation.
   */
  negatable: boolean;
};

const ARTICLE = String.raw`(?:an?|the|your|our|some|a few)`;
const UP_TO_3_WORDS = String.raw`(?:[\w-]+ ){0,3}?`;
const INTERVIEW_NOUN = String.raw`(?:interviews?|(?:phone|video|recruiter|initial|intro(?:ductory)?) screen(?:s|ing)?(?: calls?)?|screening (?:calls?|interviews?))`;
// Words between "offer you" and "position" that would make it "the chance to interview for the role".
const JOB_TITLE_WORDS = String.raw`(?:(?!(?:to|for|interview\w*|chance|opportunity)\b)[\w/&+#.-]+ ){0,6}?`;

const rule = (
  id: string,
  classification: RecruitingClassification,
  strength: SignalStrength,
  source: string,
  negatable = classification !== "REJECTION",
): SignalRule => ({ id, classification, strength, pattern: new RegExp(source, "gi"), negatable });

export const SIGNAL_RULES: SignalRule[] = [
  // Application confirmation
  rule("received-application", "APPLICATION_CONFIRMATION", "strong",
    String.raw`\b(?:we|i)(?:'ve| have)? (?:successfully |now |already )?(?:received|got|gotten) your (?:job |online )?application\b`),
  rule("application-was-received", "APPLICATION_CONFIRMATION", "strong",
    String.raw`\byour (?:job |online )?application (?:has been|was|is) (?:successfully )?(?:received|submitted|complete)\b`),
  rule("thanks-for-applying", "APPLICATION_CONFIRMATION", "strong",
    String.raw`\bthank(?:s| you) for (?:applying|your (?:recent )?application|submitting your application)\b`),
  rule("application-received-label", "APPLICATION_CONFIRMATION", "strong",
    String.raw`\bapplication (?:received|submitted|confirmation|acknowledge?ment)\b`),
  rule("confirm-receipt", "APPLICATION_CONFIRMATION", "strong",
    String.raw`\bconfirms? (?:that )?(?:we(?:'ve| have) received |receipt of )your application\b`),
  rule("application-sent-to", "APPLICATION_CONFIRMATION", "strong",
    String.raw`\byour application was sent to\b`),
  rule("thanks-for-interest", "APPLICATION_CONFIRMATION", "supporting",
    String.raw`\bthank(?:s| you) for (?:your )?interest in\b`),
  rule("will-review-application", "APPLICATION_CONFIRMATION", "supporting",
    String.raw`\b(?:we|our (?:team|recruiters?)) (?:will|are going to) (?:carefully )?review (?:your|all) (?:application|qualifications|resume|experience)\b`),

  // Interview
  rule("invite-to-interview", "INTERVIEW", "strong",
    String.raw`\b(?:like|love|want|happy|pleased|excited|delighted) to (?:invite you (?:to|for)|schedule|set up|arrange|book|line up|move forward with) ${ARTICLE}? ?${UP_TO_3_WORDS}${INTERVIEW_NOUN}\b`),
  rule("want-to-interview-you", "INTERVIEW", "strong",
    String.raw`\b(?:like|love|want) to interview you\b`),
  rule("invited-to-interview", "INTERVIEW", "strong",
    String.raw`\binvit(?:e|es|ed|ing) you (?:to|for) ${ARTICLE}? ?${UP_TO_3_WORDS}${INTERVIEW_NOUN}\b`),
  rule("interview-invitation-label", "INTERVIEW", "strong",
    String.raw`\binterview (?:invitation|invite|request|confirmation|scheduling|scheduled)\b`),
  rule("invitation-to-interview", "INTERVIEW", "strong",
    String.raw`\binvitation to ${ARTICLE}? ?(?:[\w-]+ ){0,2}?${INTERVIEW_NOUN}\b`),
  rule("schedule-interview", "INTERVIEW", "strong",
    String.raw`\b(?:re)?schedul(?:e|ing) ${ARTICLE}? ?${UP_TO_3_WORDS}${INTERVIEW_NOUN}\b`),
  rule("interview-is-scheduled", "INTERVIEW", "strong",
    String.raw`\byour (?:[\w-]+ ){0,2}?interview (?:(?:with|at) (?:[\w&'.-]+ ){1,4}?)?(?:is|has been) (?:scheduled|confirmed|booked|set)\b`),
  rule("pick-interview-time", "INTERVIEW", "strong",
    String.raw`\b(?:select|choose|pick|book|share) (?:a |your )?(?:times?|slots?|availability) (?:for|to (?:schedule|book)) (?:an?|your|the) (?:[\w-]+ ){0,2}?${INTERVIEW_NOUN}\b`),
  rule("next-round-interview", "INTERVIEW", "strong",
    String.raw`\b(?:advance|move|proceed|progress)(?:d|s|ing)? (?:you )?(?:forward )?to the next (?:round|stage|step) (?:of|in) (?:the |our )?interview(?:ing)? process\b`),
  rule("next-round-hiring", "INTERVIEW", "supporting",
    String.raw`\b(?:advance|move|proceed|progress)(?:d|s|ing)? (?:you )?(?:forward )?to the next (?:round|stage|step)\b`),
  rule("move-forward-with-application", "INTERVIEW", "supporting",
    String.raw`\b(?:like|happy|pleased|excited) to (?:move|proceed) forward with your (?:application|candidacy)\b`),

  // Rejection
  rule("forward-with-other-candidates", "REJECTION", "strong",
    String.raw`\b(?:move|moving|go|going|proceed|proceeding) forward with (?:other|another|a different|different|more qualified) (?:candidates?|applicants?|individuals?|people)\b`),
  rule("not-moving-forward", "REJECTION", "strong",
    String.raw`\b(?:not|won't|unable to|cannot|can't) (?:be )?(?:able to )?(?:move|moving|go|going|proceed|proceeding|progress|progressing) (?:forward )?with your (?:application|candidacy|profile)\b`),
  rule("decided-not-to-proceed", "REJECTION", "strong",
    String.raw`\bdecided not to (?:move forward|proceed|pursue|continue|advance|progress)\b`),
  rule("pursue-other-candidates", "REJECTION", "strong",
    String.raw`\bpursu(?:e|ing) (?:other|another) (?:candidates?|applicants?)\b`),
  rule("better-matched-candidates", "REJECTION", "strong",
    String.raw`\b(?:other|another) candidates? (?:whose|who) (?:qualifications|experience|skills|background)s? (?:more closely|better|most closely) (?:match|align|fit)`),
  rule("no-longer-considered", "REJECTION", "strong",
    String.raw`\b(?:no longer|not) (?:be )?(?:being )?consider(?:ed|ing) (?:you\b|your (?:application|candidacy))`),
  rule("application-unsuccessful", "REJECTION", "strong",
    String.raw`\byour (?:application|candidacy) (?:was|has been|is) (?:unsuccessful|declined|rejected|not (?:selected|successful))\b`),
  rule("not-selected", "REJECTION", "strong",
    String.raw`\b(?:not|weren't|were not|haven't been|have not been) (?:been )?(?:selected|shortlisted|chosen) (?:to move forward|for (?:the|this|an?|further))\b`),
  rule("no-offer", "REJECTION", "strong",
    String.raw`\b(?:not|won't|unable to|decided not to) (?:be )?(?:able to )?(?:extend|extending|offer|offering|make|making) (?:you )?(?:an?|the)? ?(?:job |employment )?offer\b`),
  rule("cannot-offer-position", "REJECTION", "strong",
    String.raw`\b(?:not|won't|unable to|cannot|can't) (?:be )?(?:able to )?offer you (?:the |a |an )?${JOB_TITLE_WORDS}(?:position|role|job)\b`),
  rule("position-filled", "REJECTION", "strong",
    String.raw`\b(?:position|role|requisition|job|opening) (?:has|have) (?:now )?(?:been )?(?:filled|closed|cancell?ed)\b`),
  rule("regret-to-inform", "REJECTION", "supporting",
    String.raw`\bregret to (?:inform|let you know|advise)\b`),
  rule("not-a-fit", "REJECTION", "supporting",
    String.raw`\bnot (?:a|the) (?:right |strong )?(?:fit|match) for\b`),
  rule("encourage-future-applications", "REJECTION", "supporting",
    String.raw`\bencourage you to (?:apply|keep an eye|check|consider) (?:for |on |out )?(?:other|future)\b`),

  // Offer
  rule("pleased-to-extend-offer", "OFFER", "strong",
    String.raw`\b(?:pleased|delighted|happy|thrilled|excited|glad|like|love|want) to (?:formally )?(?:extend|offer) (?:to )?you (?:an? |the )?(?:formal |verbal |written |official )?(?:job |employment )?offer\b`),
  rule("pleased-to-offer-position", "OFFER", "strong",
    String.raw`\b(?:pleased|delighted|happy|thrilled|excited|glad|like|love|want) to (?:formally )?offer you (?:the |a |an )?${JOB_TITLE_WORDS}(?:position|role|job)\b`),
  rule("extend-offer", "OFFER", "strong",
    String.raw`\b(?:extend|extending|extended) (?:you )?(?:an? |the )?(?:formal |verbal |written |official )?(?:job |employment )?offer\b`),
  rule("offer-letter", "OFFER", "strong",
    String.raw`\boffer (?:letter|of employment)\b`),
  rule("job-offer", "OFFER", "strong",
    String.raw`\bjob offer\b(?!s)`),
  rule("respond-to-offer", "OFFER", "supporting",
    String.raw`\b(?:accept|review|sign|decline) (?:the |your |this )?(?:job |employment )?offer\b`),
  rule("welcome-aboard", "OFFER", "supporting",
    String.raw`\bwelcome (?:aboard|to the team)\b`),

  // Follow-up / additional information request
  rule("please-provide-details", "ADDITIONAL_INFORMATION_REQUEST", "strong",
    String.raw`\bplease (?:provide|send|share|submit|confirm|upload|let us know|reply with|respond with) (?:us )?(?:with )?(?:your |the |a |an |any )?(?:[\w-]+ ){0,2}?(?:availability|references?|transcripts?|portfolio|work samples?|writing samples?|work authorization|visa status|(?:salary|compensation) expectations?|start date|resume|cv|cover letter|additional (?:information|details|documents?)|the following|documents?)\b`),
  rule("additional-info-needed", "ADDITIONAL_INFORMATION_REQUEST", "strong",
    String.raw`\b(?:additional|more|further|missing) (?:information|details|documents?|documentation) (?:is |are )?(?:needed|required|requested)\b`),
  rule("need-more-info", "ADDITIONAL_INFORMATION_REQUEST", "strong",
    String.raw`\b(?:we|i) (?:need|require|would need) (?:some )?(?:additional|more|further) (?:information|details|documents?)\b`),
  rule("complete-form", "ADDITIONAL_INFORMATION_REQUEST", "strong",
    String.raw`\b(?:complete|fill out|fill in|finish) (?:the|this|our|your|an?) (?:[\w-]+ ){0,2}?(?:form|questionnaire|application|profile|background check|assessment|challenge|assignment|exercise)\b`),
  rule("ask-availability", "ADDITIONAL_INFORMATION_REQUEST", "supporting",
    String.raw`\b(?:what|when) (?:is|are|would be) your (?:availability|earliest start date|(?:salary|compensation) expectations?)\b`),
];

export const NEGATION_CUE =
  /\b(?:not|no longer|unable to|won't|will not|cannot|can't|couldn't|isn't|aren't|wasn't|weren't|don't|didn't|never|neither|nor)\b/i;

export const CONDITIONAL_CUE =
  /\b(?:if|once|whether|unless|in the event|in case|should (?:you|your|we|there|the))\b/i;

/** Phrases that mention an interview in the past rather than inviting one. */
export const PRIOR_INTERVIEW =
  /\b(?:thank(?:s| you) for (?:your time |taking the time to )?(?:interview(?:ing)?|speak(?:ing)?|meet(?:ing)?|talk(?:ing)?)|after (?:careful consideration of |reviewing )?your (?:recent |final )?interview|your (?:recent|previous|final) interview)\b/i;

export type ContextRule = { id: string; strong: boolean; pattern: RegExp };

/**
 * Recruiting vocabulary. "Strong" terms rarely appear outside hiring and block an IGNORED
 * disposition; "weak" terms also appear in marketing and only corroborate a classification.
 */
export const CONTEXT_RULES: ContextRule[] = [
  { id: "your application", strong: true, pattern: /\byour (?:job )?application\b/i },
  { id: "applied", strong: true, pattern: /\b(?:you (?:recently )?applied|applied (?:for|to)|applying (?:for|to))\b/i },
  { id: "candidacy", strong: true, pattern: /\bcandidacy\b/i },
  { id: "recruiter", strong: true, pattern: /\brecruit(?:er|ers|ing|ment)\b/i },
  { id: "talent acquisition", strong: true, pattern: /\btalent (?:acquisition|team|partner)\b/i },
  { id: "hiring", strong: true, pattern: /\bhiring (?:process|team|manager|committee|decision)\b/i },
  { id: "interview", strong: true, pattern: /\binterview(?:s|ed|ing|er|ers)?\b/i },
  { id: "requisition", strong: true, pattern: /\b(?:requisition|req(?:uisition)? id|job id)\b/i },
  { id: "resume", strong: true, pattern: /\byour (?:resume|résumé|cv)\b/i },
  { id: "position", strong: false, pattern: /\bposition\b/i },
  { id: "role", strong: false, pattern: /\brole\b/i },
  { id: "job", strong: false, pattern: /\bjob\b/i },
  { id: "candidate", strong: false, pattern: /\bcandidates?\b/i },
  { id: "employment", strong: false, pattern: /\bemployment\b/i },
];

export type PromoRule = {
  id: string;
  /** Strong signals describe the email as a whole; bulk markers only show it was sent to a list. */
  strong: boolean;
  /** Retail language mixed with recruiting phrases is a conflict; job-board footers are routine. */
  conflictsWithRecruiting: boolean;
  pattern: RegExp;
};

export const PROMO_RULES: PromoRule[] = [
  { id: "percent savings", strong: true, conflictsWithRecruiting: true,
    pattern: /\b\d{1,2}% off\b|\bsave (?:up to )?\d{1,2}%|\b\d{1,2}% (?:discount|savings)\b/i },
  { id: "discount", strong: true, conflictsWithRecruiting: true,
    pattern: /\b(?:discounts?|coupons?|promo(?:tion(?:al)?)? codes?)\b/i },
  { id: "sale", strong: true, conflictsWithRecruiting: true,
    pattern: /\b(?:(?:flash|weekend|holiday|summer|winter|spring|fall|clearance|annual|black friday|cyber monday) (?:sale|deals?)|on sale|sale ends)\b/i },
  { id: "shopping", strong: true, conflictsWithRecruiting: true,
    pattern: /\b(?:(?:shop|buy|order) now|shop (?:the|our|all)|shopping)\b/i },
  { id: "promotional offer", strong: true, conflictsWithRecruiting: true,
    pattern: /\b(?:special|exclusive|limited[- ]time|members?[- ]only|introductory) offers?\b/i },
  { id: "free shipping", strong: true, conflictsWithRecruiting: true,
    pattern: /\bfree (?:shipping|delivery|returns|trial)\b/i },
  { id: "order update", strong: true, conflictsWithRecruiting: true,
    pattern: /\b(?:your (?:order|package|shipment) (?:has shipped|has been delivered|is on (?:its|the) way)|tracking number)\b/i },
  { id: "billing", strong: true, conflictsWithRecruiting: true,
    pattern: /\b(?:your (?:statement|bill|invoice|receipt) is (?:ready|available)|payment (?:received|due))\b/i },
  { id: "job alert", strong: true, conflictsWithRecruiting: false,
    pattern: /\b(?:jobs? (?:you may (?:be interested in|like)|for you|recommended for you)|job alerts?|new jobs? (?:matching|that match|near you)|recommended jobs?)\b/i },
  { id: "unsubscribe", strong: false, conflictsWithRecruiting: false,
    pattern: /\bunsubscribe\b/i },
  { id: "view in browser", strong: false, conflictsWithRecruiting: false,
    pattern: /\bview (?:this email |it )?(?:in|on) (?:your |a )?(?:web )?browser\b/i },
  { id: "email preferences", strong: false, conflictsWithRecruiting: false,
    pattern: /\b(?:manage|update) (?:your )?(?:email )?(?:preferences|subscriptions?)\b/i },
  { id: "newsletter", strong: false, conflictsWithRecruiting: false,
    pattern: /\b(?:newsletter|webinar)\b/i },
];

const domainSet = (domains: string[]) => new Set(domains);

export const ATS_DOMAINS = domainSet([
  "greenhouse.io", "greenhouse-mail.io", "lever.co", "myworkday.com", "myworkdayjobs.com",
  "workday.com", "smartrecruiters.com", "icims.com", "jobvite.com", "ashbyhq.com", "taleo.net",
  "successfactors.com", "successfactors.eu", "bamboohr.com", "workable.com", "workablemail.com",
  "recruitee.com", "breezy.hr", "jazzhr.com", "applytojob.com", "teamtailor.com",
  "teamtailor-mail.com", "eightfold.ai", "avature.net", "paradox.ai", "oraclecloud.com",
]);

export const JOB_BOARD_DOMAINS = domainSet([
  "linkedin.com", "indeed.com", "indeedemail.com", "ziprecruiter.com", "glassdoor.com",
  "wellfound.com", "angel.co", "dice.com", "monster.com", "joinhandshake.com", "hired.com",
  "otta.com", "welcometothejungle.com",
]);

/** Display names of tools that send on behalf of employers; never a company name. */
export const PLATFORM_NAMES = new Set([
  "greenhouse", "lever", "workday", "smartrecruiters", "icims", "jobvite", "ashby", "taleo",
  "successfactors", "bamboohr", "workable", "recruitee", "breezy", "jazzhr", "teamtailor",
  "linkedin", "indeed", "ziprecruiter", "glassdoor", "wellfound", "dice", "monster", "handshake",
  "no-reply", "noreply", "do not reply", "notifications",
]);

export const RECRUITING_MAILBOX =
  /^(?:careers?|jobs?|recruit\w*|talent\w*|hiring|hr|people|staffing|apply|applications?|candidates?)(?:[-_.+]\w*)*$/i;

export const RECRUITING_DISPLAY_SUFFIX =
  /\s+(?:recruiting|recruitment|careers|jobs|talent(?: acquisition)?|hiring|hr|people)(?:\s+team)?$/i;

export function domainMatches(domain: string, set: Set<string>): string | null {
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = parts.slice(i).join(".");
    if (set.has(candidate)) return candidate;
  }
  return null;
}
