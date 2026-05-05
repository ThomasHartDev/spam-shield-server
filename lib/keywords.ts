// Keywords that flag a voicemail as spam. Match is case-insensitive substring;
// short words are anchored on word boundaries to avoid "loan" matching "alone".

const SUBSTRING_KEYWORDS = [
  "tax relief",
  "tax debt",
  "back taxes",
  "irs",
  "student loan",
  "student loans",
  "personal loan",
  "auto loan",
  "consolidate",
  "consolidation",
  "debt relief",
  "debt forgiveness",
  "credit card debt",
  "lower your interest",
  "extended warranty",
  "social security",
];

const WORD_KEYWORDS = ["loan", "loans", "creditor", "lender"];

export type ClassificationResult = {
  matched: string[];
  isSpam: boolean;
};

export function classifyTranscript(transcript: string): ClassificationResult {
  const lower = transcript.toLowerCase();
  const matched = new Set<string>();

  for (const k of SUBSTRING_KEYWORDS) {
    if (lower.includes(k)) matched.add(k);
  }

  for (const k of WORD_KEYWORDS) {
    const re = new RegExp(`\\b${k}\\b`, "i");
    if (re.test(transcript)) matched.add(k);
  }

  return {
    matched: [...matched],
    isSpam: matched.size > 0,
  };
}

// Suggested label, derived from the matched keywords.
export function deriveLabel(matched: string[]): string {
  if (matched.some((m) => m.includes("tax") || m === "irs")) return "Tax Relief Spam";
  if (matched.some((m) => m.includes("loan") || m.includes("credit")))
    return "Loan / Credit Spam";
  if (matched.some((m) => m.includes("warranty"))) return "Warranty Spam";
  if (matched.some((m) => m.includes("social security"))) return "SSA Spam";
  return "Spam";
}
