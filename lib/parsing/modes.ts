import { BasicEmailParser } from "./basic-parser";
import {
  MAX_EVIDENCE_ITEMS,
  parseResultSchema,
  type EmailParser,
  type EmailParserInput,
  type ParseResult,
} from "./contract";

export const PARSING_MODES = ["BASIC", "HYBRID", "AI"] as const;
export type ParsingMode = (typeof PARSING_MODES)[number];

export class AiParserUnavailableError extends Error {
  constructor() {
    super("AI parsing mode requires a configured AI parser");
    this.name = "AiParserUnavailableError";
  }
}

/** Uses the rule-based result unless it needs review, then defers to the AI parser. */
class HybridEmailParser implements EmailParser {
  constructor(
    private readonly basic: EmailParser,
    private readonly ai: EmailParser,
  ) {}

  async parse(email: EmailParserInput): Promise<ParseResult> {
    const basic = await this.basic.parse(email);
    if (!basic.needsReview) return basic;
    try {
      return parseResultSchema.parse(await this.ai.parse(email));
    } catch {
      return {
        ...basic,
        evidence: [
          ...basic.evidence.slice(0, MAX_EVIDENCE_ITEMS - 1),
          "AI fallback failed; kept the rule-based result",
        ],
      };
    }
  }
}

class ValidatingEmailParser implements EmailParser {
  constructor(private readonly inner: EmailParser) {}

  async parse(email: EmailParserInput): Promise<ParseResult> {
    return parseResultSchema.parse(await this.inner.parse(email));
  }
}

/**
 * BASIC needs no API key. HYBRID without an AI parser behaves like BASIC, whose uncertain results
 * are already flagged NEEDS_REVIEW. No AI parser exists yet; `aiParser` is the extension point.
 */
export function createEmailParser(
  mode: ParsingMode = "BASIC",
  options: { aiParser?: EmailParser } = {},
): EmailParser {
  const basic = new BasicEmailParser();
  switch (mode) {
    case "BASIC":
      return basic;
    case "HYBRID":
      return options.aiParser ? new HybridEmailParser(basic, options.aiParser) : basic;
    case "AI":
      if (!options.aiParser) throw new AiParserUnavailableError();
      return new ValidatingEmailParser(options.aiParser);
  }
}
