/**
 * Reports moderation violations to the server, which counts them and
 * automatically suspends an account after 3 violations of a kind in 24h.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ViolationKind } from "@/lib/moderation";

export interface ViolationOutcome {
  count: number;
  action: "warned" | "suspended";
}

export async function recordViolation(
  kind: ViolationKind,
  opts: { severity?: number; details?: Record<string, unknown>; sessionId?: string } = {},
): Promise<ViolationOutcome | null> {
  try {
    const { data, error } = await supabase.rpc("record_moderation_violation", {
      p_kind: kind,
      p_severity: opts.severity ?? 1,
      p_details: (opts.details ?? {}) as never,
      p_session_id: opts.sessionId ?? null,
    });
    if (error) return null;
    const row = data as unknown as ViolationOutcome | null;
    return row ?? null;
  } catch {
    return null;
  }
}
