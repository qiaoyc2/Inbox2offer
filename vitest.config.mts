import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fromRoot("./") },
      // Next.js resolves "server-only" itself; outside Next it would throw on import.
      { find: /^server-only$/, replacement: fromRoot("./tests/stubs/server-only.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Relative to prisma/schema.prisma, so this is prisma/test.db (gitignored), never dev.db.
    env: { DATABASE_URL: "file:./test.db" },
    fileParallelism: false,
  },
});
