// Browser system notifications for incoming calls, so the user still sees the
// ring when this tab is in the background or another app is in the foreground.

export type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notifyPermission(): NotifyPermission {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission as NotifyPermission;
}

export async function requestCallNotifications(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const res = await Notification.requestPermission();
    return res as NotifyPermission;
  } catch {
    return notifyPermission();
  }
}

let active: Notification | null = null;

export function showIncomingCallNotification(opts: {
  name: string;
  mode: "video" | "audio";
  onClick?: () => void;
}) {
  if (notifyPermission() !== "granted") return;
  closeIncomingCallNotification();
  try {
    const n = new Notification(`📞 Incoming ${opts.mode === "video" ? "video" : "voice"} call`, {
      body: `${opts.name} is calling you on Meetup`,
      tag: "meetup-incoming-call",
      requireInteraction: true,
      silent: false,
    } as NotificationOptions);
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* noop */
      }
      opts.onClick?.();
      n.close();
    };
    active = n;
  } catch {
    /* noop */
  }
}

export function closeIncomingCallNotification() {
  try {
    active?.close();
  } catch {
    /* noop */
  }
  active = null;
}
