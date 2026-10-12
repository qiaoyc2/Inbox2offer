import { describe, expect, it, vi } from "vitest";
import { BASIC_PARSER_VERSION, BasicEmailParser } from "@/lib/parsing/basic-parser";
import {
  parseResultSchema,
  type EmailParser,
  type EmailParserInput,
  type ParseResult,
} from "@/lib/parsing/contract";
import { AiParserUnavailableError, createEmailParser } from "@/lib/parsing/modes";

const parser = new BasicEmailParser();
const NEUTRAL_SENDER = "someone@example.com";

function parse(subject: string, body: string, sender = NEUTRAL_SENDER): Promise<ParseResult> {
  return parser.parse({ sender, subject, body });
}

describe("classification of the milestone examples", () => {
  it("application confirmation", async () => {
    const result = await parse(
      "Thank you for applying to Amazon",
      "We received your application for the Software Engineer position.",
    );
    expect(result.classification).toBe("APPLICATION_CONFIRMATION");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.company).toBe("Amazon");
    expect(result.position).toBe("Software Engineer");
  });

  it("interview invitation", async () => {
    const result = await parse(
      "Interview Invitation — Data Engineer",
      "We'd like to schedule an interview for the Data Engineer position.",
    );
    expect(result.classification).toBe("INTERVIEW");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.position).toBe("Data Engineer");
  });

  it("rejection", async () => {
    const result = await parse(
      "Update on your application",
      "We have decided to move forward with other candidates.",
    );
    expect(result.classification).toBe("REJECTION");
    expect(result.disposition).toBe("JOB_RELATED");
  });

  it("offer", async () => {
    const result = await parse(
      "Job Offer — Backend Engineer",
      "We are pleased to offer you the Backend Engineer position.",
    );
    expect(result.classification).toBe("OFFER");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.position).toBe("Backend Engineer");
  });

  it("follow-up with hiring context is job related", async () => {
    const result = await parse(
      "Additional information needed",
      "Please provide your availability to continue the hiring process.",
    );
    expect(result.classification).toBe("ADDITIONAL_INFORMATION_REQUEST");
    expect(result.disposition).toBe("JOB_RELATED");
  });

  it("follow-up without recruiting context needs review", async () => {
    const result = await parse("Additional information needed", "Please provide your availability.");
    expect(result.classification).toBe("ADDITIONAL_INFORMATION_REQUEST");
    expect(result.disposition).toBe("NEEDS_REVIEW");
    expect(result.needsReview).toBe(true);
  });

  it("clearly unrelated promotion is ignored", async () => {
    const result = await parse(
      "Your weekend shopping discounts",
      "Save 25% on selected clothing this weekend.",
    );
    expect(result.classification).toBe("UNRELATED");
    expect(result.disposition).toBe("IGNORED");
    expect(result.needsReview).toBe(false);
  });

  it("ambiguous message needs review", async () => {
    const result = await parse("Checking in", "Let me know when you are available to talk.");
    expect(result.classification).toBe("UNKNOWN");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("multiple events use the actionable one as primary", async () => {
    const result = await parse(
      "Next Steps for Your Application",
      "Thank you for applying to Amazon. We received your application and would like to schedule an interview.",
    );
    expect(result.classification).toBe("INTERVIEW");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.secondarySignals).toContain("APPLICATION_CONFIRMATION");
    expect(result.company).toBe("Amazon");
  });
});

describe("common phrasing variants", () => {
  it.each([
    ["OFFER", "Congratulations!", "We would like to offer you the Software Engineer position at Stripe."],
    ["INTERVIEW", "Confirmed", "Your interview with Acme is confirmed for Tuesday at 10am."],
    ["INTERVIEW", "Next steps", "I'd like to schedule a 30-minute recruiter screen to discuss the role."],
    ["ADDITIONAL_INFORMATION_REQUEST", "Coding challenge",
      "As the next step in our hiring process, please complete the online coding assessment within 5 days."],
  ])("recognizes %s: %s", async (expected, subject, body) => {
    const result = await parse(subject, body);
    expect(result.classification).toBe(expected);
    expect(result.disposition).toBe("JOB_RELATED");
  });

  it("does not read 'offer you the chance to interview' as a job offer", async () => {
    const result = await parse(
      "Good news",
      "We are pleased to offer you the chance to interview for the Backend Engineer role.",
    );
    expect(result.classification).not.toBe("OFFER");
  });

  it("does not read a retail 'like to offer you' as a job offer", async () => {
    const result = await parse(
      "Just for you",
      "We'd like to offer you 20% off your next order. Shop now and enjoy free shipping.",
    );
    expect(result.disposition).toBe("IGNORED");
  });

  it("does not treat a cancelled interview as an interview invitation", async () => {
    const result = await parse("Update", "Your interview with Acme has been cancelled.");
    expect(result.classification).toBe("UNKNOWN");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });
});

describe("multiple and conflicting signals", () => {
  it("rejection after an interview is a rejection with the interview kept as evidence", async () => {
    const result = await parse(
      "Your application",
      "Thank you for interviewing. Unfortunately, we are moving forward with another candidate.",
    );
    expect(result.classification).toBe("REJECTION");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.evidence.some((line) => line.startsWith("References a prior interview"))).toBe(true);
  });

  it("contradictory current outcomes are unknown and need review", async () => {
    const result = await parse(
      "Your application",
      "We'd like to schedule an interview for the Data Engineer position. We have decided to move forward with other candidates.",
    );
    expect(result.classification).toBe("UNKNOWN");
    expect(result.disposition).toBe("NEEDS_REVIEW");
    expect(result.secondarySignals).toEqual(expect.arrayContaining(["INTERVIEW", "REJECTION"]));
  });

  it("offer and rejection in the same message conflict", async () => {
    const result = await parse(
      "Update",
      "We are pleased to offer you the Backend Engineer position. Unfortunately, the position has been filled.",
    );
    expect(result.classification).toBe("UNKNOWN");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("an offer that asks for documents is still an offer", async () => {
    const result = await parse(
      "Your offer",
      "We are delighted to extend you an offer for the Staff Engineer role. Please send your references by Friday.",
    );
    expect(result.classification).toBe("OFFER");
    expect(result.secondarySignals).toContain("ADDITIONAL_INFORMATION_REQUEST");
  });
});

describe("disposition", () => {
  it("never ignores an unknown message just because it is unfamiliar", async () => {
    const result = await parse("Friday", "Are we still on for dinner? Let me know.");
    expect(result.classification).toBe("UNKNOWN");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("does not ignore on a single non-recruiting signal", async () => {
    const result = await parse("Statement", "Your statement is ready to view online.");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("does not ignore promotions that mention recruiting", async () => {
    const result = await parse(
      "Ace your next interview",
      "Get 30% off our interview coaching course. Shop now!",
    );
    expect(result.disposition).not.toBe("IGNORED");
  });

  it("flags recruiting phrases mixed with retail promotion for review", async () => {
    const result = await parse(
      "Limited-time offer",
      "Schedule an interview with a career coach today and save 20%. Shop now.",
    );
    expect(result.classification).toBe("INTERVIEW");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("does not let the sender domain decide relevance", async () => {
    const body = "We received your application for the Software Engineer position.";
    const fromShop = await parse("Application received", body, "Deals <deals@shop-example.com>");
    const fromCareers = await parse("Application received", body, "Careers <careers@example.com>");
    expect(fromShop.classification).toBe("APPLICATION_CONFIRMATION");
    expect(fromShop.disposition).toBe("JOB_RELATED");
    expect(fromCareers.disposition).toBe("JOB_RELATED");

    // A recruiting sender keeps an otherwise promotional email reviewable rather than ignored.
    const promoFromCareers = await parse(
      "Weekend sale",
      "Save 25% on hoodies this weekend. Shop now.",
      "careers@example.com",
    );
    expect(promoFromCareers.disposition).toBe("NEEDS_REVIEW");
  });

  it("treats job-board recommendation digests as unrelated to applications", async () => {
    const result = await parse(
      "Jobs you may be interested in",
      "Recommended jobs for you: Data Analyst at Initech, Product Manager at Globex.\n\nUnsubscribe",
      "LinkedIn <jobs-noreply@linkedin.com>",
    );
    expect(result.disposition).toBe("IGNORED");
  });

  it("keeps needsReview consistent with disposition", async () => {
    const samples: [string, string][] = [
      ["Thank you for applying to Amazon", "We received your application for the Software Engineer position."],
      ["Checking in", "Let me know when you are available to talk."],
      ["Your weekend shopping discounts", "Save 25% on selected clothing this weekend."],
    ];
    for (const [subject, body] of samples) {
      const result = await parse(subject, body);
      expect(result.needsReview).toBe(result.disposition === "NEEDS_REVIEW");
    }
  });
});

describe("extraction", () => {
  it("uses the ATS display name for the company, not the ATS domain", async () => {
    const result = await parse(
      "Thanks for applying",
      "Thanks for applying! We have received your application for the Senior Platform Engineer role.",
      "Acme Hiring Team <no-reply@us.greenhouse-mail.io>",
    );
    expect(result.classification).toBe("APPLICATION_CONFIRMATION");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.company).toBe("Acme");
    expect(result.position).toBe("Senior Platform Engineer");
    expect(result.evidence.some((line) => line.includes("greenhouse-mail.io"))).toBe(true);
  });

  it("never uses the ATS name as the company", async () => {
    const result = await parse(
      "Application received",
      "Thank you for your interest in Globex. We have received your application.",
      "Greenhouse <no-reply@greenhouse.io>",
    );
    expect(result.company).toBe("Globex");
  });

  it("uses the employer an agency recruiter names, not the agency domain", async () => {
    const result = await parse(
      "Opportunity",
      "I'm reaching out on behalf of Initech. We'd like to schedule an interview for the Staff Data Scientist position.",
      "Jane Doe <jane@talentbridge-staffing.com>",
    );
    expect(result.classification).toBe("INTERVIEW");
    expect(result.company).toBe("Initech");
    expect(result.position).toBe("Staff Data Scientist");
  });

  it("returns null when company and position are missing", async () => {
    const result = await parse(
      "Application received",
      "We received your application. Our team will review your qualifications shortly.",
      "careers@example.com",
    );
    expect(result.company).toBeNull();
    expect(result.position).toBeNull();
    expect(result.classification).toBe("APPLICATION_CONFIRMATION");
  });

  it("does not treat generic phrases like 'the position' as a job title", async () => {
    const result = await parse(
      "Thanks",
      "Thank you for applying for the position. We have received your application for this exciting role.",
    );
    expect(result.position).toBeNull();
  });

  it("reads a job board confirmation", async () => {
    const result = await parse(
      "Your application was sent to Initech",
      "Your application was sent to Initech for the Data Analyst role.\n\nJobs you may be interested in\nUnsubscribe",
      "LinkedIn <jobs-noreply@linkedin.com>",
    );
    expect(result.classification).toBe("APPLICATION_CONFIRMATION");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.company).toBe("Initech");
    expect(result.position).toBe("Data Analyst");
  });
});

describe("edge cases", () => {
  it("ignores capitalization and whitespace", async () => {
    const messy = await parse(
      "  UPDATE   ON YOUR APPLICATION ",
      "WE   HAVE DECIDED TO\r\n   MOVE FORWARD    WITH OTHER\r\nCANDIDATES.",
    );
    const clean = await parse(
      "Update on your application",
      "We have decided to move forward with other candidates.",
    );
    expect(messy.classification).toBe("REJECTION");
    expect(messy.disposition).toBe(clean.disposition);
  });

  it("does not classify from keywords in the signature", async () => {
    const result = await parse(
      "Interview",
      [
        "Hi Sam,",
        "",
        "We'd like to schedule an interview for the Data Engineer position.",
        "",
        "Best regards,",
        "Jane Doe",
        "Recruiting Coordinator",
        "Ask me about the job offer process and our referral program!",
      ].join("\n"),
    );
    expect(result.classification).toBe("INTERVIEW");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.secondarySignals).not.toContain("OFFER");
  });

  it("uses the newest message, not a quoted older rejection", async () => {
    const result = await parse(
      "Re: Your application",
      [
        "Hi Sam,",
        "",
        "Good news, we would like to interview you for the Frontend Engineer role next week.",
        "",
        "On Mon, Sep 1, 2026 at 9:00 AM Acme Recruiting <jobs@acme.example> wrote:",
        "> Unfortunately, we have decided to move forward with other candidates.",
      ].join("\n"),
    );
    expect(result.classification).toBe("INTERVIEW");
    expect(result.disposition).toBe("JOB_RELATED");
    expect(result.secondarySignals).not.toContain("REJECTION");
    expect(result.evidence.some((line) => line.startsWith("quoted history mentions REJECTION"))).toBe(true);
  });

  it("handles Outlook-style quoted history", async () => {
    const result = await parse(
      "RE: Offer",
      [
        "Thanks for the update. I will review and get back to you.",
        "",
        "From: Acme Recruiting <jobs@acme.example>",
        "Sent: Monday, September 1, 2026 9:00 AM",
        "Subject: Offer",
        "",
        "We are pleased to offer you the Backend Engineer position.",
      ].join("\n"),
    );
    expect(result.classification).not.toBe("OFFER");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("does not ignore a short reply that quotes a recruiting thread", async () => {
    const result = await parse(
      "Re: Interview Invitation",
      "Tuesday works for me!\n\n> We'd like to schedule an interview for the Data Engineer position.",
    );
    expect(result.classification).toBe("UNKNOWN");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("does not let a reply subject override the current message", async () => {
    const result = await parse(
      "Re: Interview Invitation",
      "Unfortunately, we have decided to move forward with other candidates.",
    );
    expect(result.classification).toBe("REJECTION");
  });

  it("analyzes the content of a forwarded email", async () => {
    const result = await parse(
      "Fwd: Job Offer",
      [
        "FYI",
        "",
        "---------- Forwarded message ---------",
        "From: Acme Recruiting <jobs@acme.example>",
        "Date: Mon, Sep 1, 2026 at 9:00 AM",
        "Subject: Job Offer",
        "To: <me@example.com>",
        "",
        "We are pleased to offer you the Backend Engineer position.",
      ].join("\n"),
    );
    expect(result.classification).toBe("OFFER");
  });

  it("treats a negated offer as a rejection", async () => {
    const result = await parse(
      "Your candidacy",
      "After careful consideration, we are not extending an offer at this time.",
    );
    expect(result.classification).toBe("REJECTION");
    expect(result.secondarySignals).not.toContain("OFFER");
    expect(result.evidence.some((line) => line.startsWith("Ignored negated OFFER"))).toBe(true);
  });

  it("does not treat a negated interview as an interview", async () => {
    const result = await parse("Update", "We will not be scheduling interviews for this role.");
    expect(result.classification).not.toBe("INTERVIEW");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("does not treat a conditional interview as an interview", async () => {
    const result = await parse(
      "Application received",
      "We received your application for the Product Designer position. If your qualifications match our needs, a recruiter will contact you to schedule an interview.",
    );
    expect(result.classification).toBe("APPLICATION_CONFIRMATION");
    expect(result.evidence.some((line) => line.startsWith("Ignored conditional INTERVIEW"))).toBe(true);
  });

  it("does not read a promotional 'offer' as a job offer", async () => {
    const result = await parse(
      "Special offer just for you",
      "Enjoy 30% off all orders this weekend. Shop now.",
    );
    expect(result.classification).toBe("UNRELATED");
    expect(result.disposition).toBe("IGNORED");
  });

  it("does not trust 'application' without recruiting context", async () => {
    const result = await parse(
      "Your credit card application",
      "We received your application for the Platinum Rewards card.",
    );
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });

  it("does not treat a non-recruiting regret as a rejection", async () => {
    const result = await parse(
      "Flight update",
      "We regret to inform you that your flight has been delayed.",
    );
    expect(result.disposition).not.toBe("JOB_RELATED");
  });

  it("rejects invalid input", async () => {
    await expect(
      parser.parse({ sender: "a@example.com", subject: 42, body: "x" } as unknown as EmailParserInput),
    ).rejects.toThrow();
    await expect(parser.parse(null as unknown as EmailParserInput)).rejects.toThrow();
  });

  it("is deterministic", async () => {
    const input: EmailParserInput = {
      sender: "Acme Recruiting <jobs@acme.example>",
      subject: "Next Steps for Your Application",
      body: "Thank you for applying to Amazon. We received your application and would like to schedule an interview.",
    };
    expect(await parser.parse(input)).toEqual(await parser.parse(input));
  });

  it("reports parser metadata and bounded confidence", async () => {
    const result = await parse("Checking in", "Let me know when you are available to talk.");
    expect(result.parserType).toBe("RULE_BASED");
    expect(result.parserVersion).toBe(BASIC_PARSER_VERSION);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThan(1);
  });
});

describe("parse result contract", () => {
  const valid: ParseResult = {
    classification: "INTERVIEW",
    disposition: "JOB_RELATED",
    company: null,
    position: null,
    confidence: 0.8,
    needsReview: false,
    parserType: "RULE_BASED",
    parserVersion: "test",
    evidence: [],
    secondarySignals: [],
  };

  it("accepts a consistent result", () => {
    expect(parseResultSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["needsReview disagrees with disposition", { needsReview: true }],
    ["JOB_RELATED with UNKNOWN", { classification: "UNKNOWN" }],
    ["IGNORED with a recruiting classification", { disposition: "IGNORED" }],
    ["confidence above 1", { confidence: 1.2 }],
    ["primary repeated as secondary", { secondarySignals: ["INTERVIEW"] }],
    ["empty company string", { company: "  " }],
  ])("rejects %s", (_label, patch) => {
    expect(parseResultSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("parsing modes", () => {
  const ambiguous: EmailParserInput = {
    sender: NEUTRAL_SENDER,
    subject: "Checking in",
    body: "Let me know when you are available to talk.",
  };
  const clear: EmailParserInput = {
    sender: NEUTRAL_SENDER,
    subject: "Update on your application",
    body: "We have decided to move forward with other candidates.",
  };
  const aiResult: ParseResult = {
    classification: "INTERVIEW",
    disposition: "JOB_RELATED",
    company: null,
    position: null,
    confidence: 0.9,
    needsReview: false,
    parserType: "AI",
    parserVersion: "stub",
    evidence: ["stub"],
    secondarySignals: [],
  };

  it("BASIC needs no AI parser", async () => {
    const result = await createEmailParser("BASIC").parse(clear);
    expect(result.parserType).toBe("RULE_BASED");
  });

  it("AI mode refuses to run without a configured AI parser", () => {
    expect(() => createEmailParser("AI")).toThrow(AiParserUnavailableError);
  });

  it("HYBRID without AI keeps the rule-based result and its review flag", async () => {
    const result = await createEmailParser("HYBRID").parse(ambiguous);
    expect(result.parserType).toBe("RULE_BASED");
    expect(result.needsReview).toBe(true);
  });

  it("HYBRID only consults the AI parser for uncertain results", async () => {
    const ai: EmailParser = { parse: vi.fn().mockResolvedValue(aiResult) };
    const hybrid = createEmailParser("HYBRID", { aiParser: ai });

    expect((await hybrid.parse(clear)).parserType).toBe("RULE_BASED");
    expect(ai.parse).not.toHaveBeenCalled();

    expect((await hybrid.parse(ambiguous)).parserType).toBe("AI");
    expect(ai.parse).toHaveBeenCalledTimes(1);
  });

  it("HYBRID falls back to the rule-based result when AI output is invalid", async () => {
    const ai: EmailParser = {
      parse: vi.fn().mockResolvedValue({ ...aiResult, confidence: 7 }),
    };
    const result = await createEmailParser("HYBRID", { aiParser: ai }).parse(ambiguous);
    expect(result.parserType).toBe("RULE_BASED");
    expect(result.disposition).toBe("NEEDS_REVIEW");
  });
});
