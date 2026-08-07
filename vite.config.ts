// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// nsfwjs does `import { Buffer } from "buffer"` purely to base64-decode its bundled
// model JSON. In browser builds Vite maps "buffer" to __vite-browser-external, which
// has no named exports, so the build fails. Swap the import for a tiny atob shim.
const nsfwjsBufferShim: Plugin = {
  name: "nsfwjs-buffer-shim",
  enforce: "pre",
  transform(code, id) {
    if (!id.includes("nsfwjs") || !code.includes('from "buffer"')) return null;
    return {
      code: code.replace(
        /import\s*\{\s*Buffer\s*\}\s*from\s*["']buffer["'];?/,
        'const Buffer = { from: (s) => ({ toString: () => atob(s) }) };',
      ),
      map: null,
    };
  },
};

export default defineConfig({
  vite: {
    plugins: [nsfwjsBufferShim],
  },
});
