import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SeoPageRecord } from "./public.server";

export const getSeoPage = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }): Promise<SeoPageRecord | null> => {
    const { fetchPublishedPage } = await import("./public.server");
    return fetchPublishedPage(data.slug);
  });

export const listSeoPages = createServerFn({ method: "GET" }).handler(
  async (): Promise<SeoPageRecord[]> => {
    const { fetchPublishedIndex } = await import("./public.server");
    return fetchPublishedIndex();
  },
);
