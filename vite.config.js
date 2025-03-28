import { defineConfig } from "vite";
import fastGlob from "fast-glob";
import path from "path";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

export default defineConfig({
  // resolve: {
  //   alias: {
  //     "@": "/src",
  //   },
  // },
  root: "src",
  base: '/gamebuilds/jumper/',
  plugins: [
    ViteImageOptimizer({
      jpeg: { quality: 100 },
      png: { quality: 100 },
      webp: { quality: 100 },
      avif: { quality: 100 },
    }),
  ],
  publicDir: "../public",
  build: {
    outDir: "../dist", // Output built files to project/dist
    emptyOutDir: true,
    // rollupOptions: {
    //   input: Object.fromEntries(
    //     fastGlob
    //       .sync("src/**/*.html", {
    //         ignore: ["node_modules/**/*", "dist/**/*"], // Exclude unwanted directories
    //       })
    //       .map((file) => [file, path.resolve(__dirname, file)])
    //   ),
    //   output: {
    //     manualChunks: undefined,
    //     entryFileNames: "scripts/[name].min.js", // Disable hashing for JS files
    //     chunkFileNames: "scripts/[name].min.js",
    //     assetFileNames: (assetInfo) => {
    //       if (/\.(css)$/.test(assetInfo.name)) {
    //         return "styles/[name].[ext]"; // Place CSS in styles/ directory
    //       }
    //       return "[name].[ext]";
    //     },
    //   },
    // },
  },
});
