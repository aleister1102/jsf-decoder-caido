import { defineConfig } from "@caido-community/dev";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  id: "jsf-decoder",
  name: "JSF Decoder",
  description: "JSF request body parser and analyzer",
  version: "0.1.0",
  author: {
    name: "insomnia1102",
  },
  plugins: [
    {
      kind: "frontend",
      id: "jsf-decoder-frontend",
      name: "JSF Decoder",
      root: "./src/frontend",
      vite: {
        plugins: [vue()],
        build: {
          rollupOptions: {
            // Caido provides a shared Vue runtime
            external: (id: string) => {
              if (id === "vue") return true;
              if (id.startsWith("vue/")) return true;
              if (id.includes("/node_modules/vue/") || id.includes("\\node_modules\\vue\\")) return true;
              return false;
            },
          },
        },
      },
    },
  ],
});
