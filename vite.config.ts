import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "/gmail-reader/",
    define: {
      "import.meta.env.VITE_GMAIL_CLIENT_ID": JSON.stringify(env.VITE_GMAIL_CLIENT_ID),
    },
    plugins: [react()],
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
  };
});
