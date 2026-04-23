// Lightweight client-side keyword filter for text chat.
// Not a full moderation system — just a first line of defence against
// the most obvious spam / abusive language. Real moderation should
// happen server-side with a proper API in production.

const BLOCKED = [
  // English
  "fuck", "shit", "bitch", "porn", "nude", "naked", "sex", "rape", "dick", "pussy",
  "asshole", "whore", "slut",
  // Hindi (romanised)
  "chutiya", "chodu", "madarchod", "behenchod", "bhenchod", "gandu", "lund", "randi",
  "harami", "kutta",
  // Common spam patterns
  "whatsapp +", "telegram @", "snap me",
];

const URL_RE = /\b((https?:\/\/|www\.)\S+|\b\S+\.(com|in|net|org|xyz|live|me)\b)/i;
const PHONE_RE = /(\+?\d[\d\s\-]{7,}\d)/;

export function filterMessage(text: string): { ok: boolean; reason?: string; clean: string } {
  const lower = text.toLowerCase();
  for (const w of BLOCKED) {
    if (lower.includes(w)) {
      return { ok: false, reason: "Inappropriate language detected.", clean: text };
    }
  }
  if (URL_RE.test(text)) {
    return { ok: false, reason: "Links are not allowed in chat.", clean: text };
  }
  if (PHONE_RE.test(text)) {
    return { ok: false, reason: "Sharing phone numbers is not allowed.", clean: text };
  }
  return { ok: true, clean: text.slice(0, 500) };
}
