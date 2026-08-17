import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // @ts-expect-error Vitest extends Vite's config at runtime.
  test: {
    // Performance budgets must not compete with parallel JSDOM/Three.js suites.
    fileParallelism: false,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "three-vendor",
              test: /node_modules[\\/]three[\\/]/,
              maxSize: 400_000,
              priority: 20,
            },
            {
              name: "icon-vendor",
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
