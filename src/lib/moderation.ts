/**
 * Text / username moderation used across text chat, DMs, rooms and profiles.
 *
 * Two severity tiers:
 *  - severity 2 ("hate"): hate speech, threats, slurs, sexual harassment →
 *    blocked AND recorded as a violation (3 in 24h = 24h suspension).
 *  - severity 1 ("spam"): links, phone numbers, contact-sharing → blocked only.
 */

export type ViolationKind = "nudity" | "hate" | "recording" | "age" | "spam";

export interface ModerationResult {
  ok: boolean;
  reason?: string;
  kind?: ViolationKind;
  severity: number;
  clean: string;
  matched?: string;
}

/** Slurs, hate speech, threats, sexual harassment. */
const HATE = [
  // sexual / harassment
  "fuck", "fuk", "fck", "shit", "bitch", "porn", "nude", "nudes", "naked", "sex",
  "sexy pic", "rape", "dick", "pussy", "boobs", "penis", "vagina", "horny",
  "asshole", "whore", "slut", "cum", "masturbat", "blowjob", "nigger", "nigga",
  "faggot", "retard",
  // threats
  "kill you", "kill u", "i will kill", "rape you", "kill yourself", "kys",
  "die bitch", "murder you", "acid attack",
  // hindi / romanised abuse
  "chutiya", "chutiye", "chodu", "chod", "madarchod", "behenchod", "bhenchod",
  "bhosdi", "bhosda", "gandu", "gaandu", "lund", "randi", "harami", "kutta",
  "kutti", "kamine", "saali", "gaand", "chinal", "hijra",
  // communal / caste hate
  "kill all muslims", "kill all hindus", "chamar", "bhangi", "terrorist scum",
];

/** Lower-severity policy violations. */
const SPAM = ["whatsapp +", "telegram @", "snap me", "onlyfans", "cashapp", "paytm me"];

const URL_RE = /\b((https?:\/\/|www\.)\S+|\S+\.(com|in|net|org|xyz|live|me|link|to)\b)/i;
const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/;

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "*": "",
};

/** Normalise leetspeak / spacing / repeats so "f.u.c.k" and "fuuuck" still match. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[013457@$!*]/g, (c) => LEET[c] ?? c)
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Also match words written with separators between every letter. */
function collapsed(text: string): string {
  return normalise(text).replace(/\s/g, "");
}

export function moderateText(text: string): ModerationResult {
  const raw = text.toLowerCase();
  const norm = normalise(text);
  const tight = collapsed(text);

  for (const w of HATE) {
    const nw = normalise(w);
    if (norm.includes(nw) || (!w.includes(" ") && tight.includes(nw.replace(/\s/g, "")))) {
      return {
        ok: false,
        severity: 2,
        kind: "hate",
        matched: w,
        reason:
          "Blocked: hate speech, abuse, threats and sexual harassment are not allowed. Repeat violations suspend your account.",
        clean: text,
      };
    }
  }

  for (const w of SPAM) {
    if (raw.includes(w)) {
      return { ok: false, severity: 1, kind: "spam", matched: w, reason: "Sharing contact details is not allowed.", clean: text };
    }
  }

  if (URL_RE.test(text)) {
    return { ok: false, severity: 1, kind: "spam", reason: "Links are not allowed in chat.", clean: text };
  }
  if (PHONE_RE.test(text)) {
    return { ok: false, severity: 1, kind: "spam", reason: "Sharing phone numbers is not allowed.", clean: text };
  }

  return { ok: true, severity: 0, clean: text.slice(0, 1000) };
}

/** Usernames / display names / bios are held to the same standard. */
export function moderateName(name: string): ModerationResult {
  const res = moderateText(name);
  if (!res.ok) {
    return { ...res, reason: `That name isn't allowed: ${res.reason ?? "policy violation"}` };
  }
  return res;
}

/** Back-compat wrapper for existing call sites. */
export function filterMessage(text: string): { ok: boolean; reason?: string; clean: string } {
  const r = moderateText(text);
  return { ok: r.ok, reason: r.reason, clean: r.clean.slice(0, 500) };
}
