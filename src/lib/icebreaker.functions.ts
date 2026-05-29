/**
 * AI Icebreaker server function.
 * Generates one short, fresh conversation starter using Lovable AI Gateway.
 * No auth required — anonymous chats also benefit.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  interests: z.array(z.string().min(1).max(40)).max(15).optional(),
  language: z.string().min(2).max(20).optional(),
});

export interface IcebreakerResponse {
  prompt: string;
}

const FALLBACKS = [
  "What's the most interesting thing you've learned this week?",
  "If you could travel anywhere right now, where would you go?",
  "What's a skill you're trying to pick up?",
  "What's a movie or show you'd recommend right now?",
  "Coffee, chai, or something else — what's your daily fuel?",
  "What's playing on your headphones today?",
];

export const generateIcebreaker = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<IcebreakerResponse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { prompt: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)] };
    }

    const interestsLine = data.interests?.length
      ? `The other person's interests include: ${data.interests.join(", ")}.`
      : "";
    const lang = data.language || "English";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "You generate ONE short, friendly, original ice-breaker question for two strangers about to chat on a random video chat app. " +
                "Rules: 1 sentence, max 18 words, must be a question, no emojis, no quotes, no preamble, no 'Hello'. " +
                `Reply in ${lang}.`,
            },
            {
              role: "user",
              content: `Give me a fresh icebreaker. ${interestsLine}`.trim(),
            },
          ],
          temperature: 1.1,
        }),
      });

      if (!res.ok) {
        return { prompt: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)] };
      }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { prompt: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)] };
      }
      // strip surrounding quotes if any
      const cleaned = text.replace(/^["'`]+|["'`]+$/g, "").slice(0, 200);
      return { prompt: cleaned };
    } catch {
      return { prompt: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)] };
    }
  });
