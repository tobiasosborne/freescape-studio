import { build } from "esbuild";
import { fileURLToPath } from "node:url";
export async function bundlePlayer() {
  return (
    await build({
      entryPoints: [
        fileURLToPath(new URL("../src/player.js", import.meta.url)),
      ],
      bundle: true,
      format: "iife",
      minify: true,
      write: false,
      target: "es2022",
    })
  ).outputFiles[0].text;
}
export const playerPlugin = {
  name: "standalone-player",
  setup(builder) {
    builder.onResolve({ filter: /\?bundle$/ }, (args) => ({
      path: args.path,
      namespace: "player-bundle",
    }));
    builder.onLoad({ filter: /.*/, namespace: "player-bundle" }, async () => ({
      contents: `export default ${JSON.stringify(await bundlePlayer())}`,
      loader: "js",
    }));
  },
};
