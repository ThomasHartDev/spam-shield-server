// Normalize any phone-number-ish string to E.164-without-plus (digits only).
// Returns null if the cleaned digits don't look like a real phone number.
export function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  // Default to US if we got 10 digits and no country code
  if (digits.length === 10) return `1${digits}`;
  return digits;
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
