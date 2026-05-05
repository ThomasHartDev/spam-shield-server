// Normalize any phone-number-ish string to E.164-without-plus (digits only).
// Returns null if the cleaned digits don't look like a real phone number.
export function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  // Default to US if we got 10 digits and no country code
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

// Pull a phone-number-ish substring out of free text. Prefers E.164 form,
// then 10/11-digit US patterns. Returns the raw matched string (not normalized);
// hand the result to normalizeE164 to get the canonical form.
export function extractPhoneNumber(text: string): string | null {
  // E.164 with explicit +: most reliable signal a string is a phone number
  const e164 = text.match(/\+\d{10,15}/);
  if (e164) return e164[0];

  // US format with delimiters: (801) 555-1234, 801-555-1234, 801.555.1234, 801 555 1234
  const formatted = text.match(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/,
  );
  if (formatted) return formatted[0];

  // Bare 10 or 11 digit run, but only if it's clearly a phone number context
  // (the caller-id "from" line, etc). Too greedy as a general matcher.
  return null;
}

// Pretty-print US numbers, fall back to a +<digits> form for everything else.
export function formatPhone(e164: string): string {
  if (e164.length === 11 && e164.startsWith("1")) {
    const area = e164.slice(1, 4);
    const mid = e164.slice(4, 7);
    const last = e164.slice(7);
    return `+1 (${area}) ${mid}-${last}`;
  }
  return `+${e164}`;
}
