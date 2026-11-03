import { defineConfig } from "vite";
import { bundlePlayer } from "./scripts/bundle.mjs";
export default defineConfig({
  plugins: [
    {
      name: "standalone-player",
      async load(id) {
        if (id.endsWith("?bundle"))
          return `export default ${JSON.stringify(await bundlePlayer())}`;
      },
    },
  ],
});
