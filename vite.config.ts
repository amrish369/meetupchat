// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// nsfwjs does `import { Buffer } from "buffer"`, which Vite maps to
// __vite-browser-external in browser builds. Redirect it to the polyfill package.
const bufferAlias = { find: /^buffer$/, replacement: "buffer/index.js" };

export default defineConfig({
  vite: {
    resolve: { alias: [bufferAlias] },
  },
});
