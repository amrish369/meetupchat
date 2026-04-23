// Anonymous guest session. UUID stored in localStorage only.
// No PII, no tracking — purely so the same browser keeps a stable id
// across reconnects (helps with ban enforcement & report attribution).

const KEY = "meetup_session_id";

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function resetSessionId(): string {
  if (typeof window === "undefined") return "";
  const id = uuid();
  localStorage.setItem(KEY, id);
  return id;
}
