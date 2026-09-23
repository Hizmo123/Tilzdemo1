import { defineConfig } from "vitest/config";
import path from "path";

// Minimal test config — the codebase had zero test coverage before the
// regression-fix pass this file was added for (see the audit-fix commits).
// Tests mock @/lib/prisma directly (see src/test/prisma-mock.ts) rather than
// hitting a real database: fast, no test-DB provisioning/teardown risk
// against the real Supabase instance this project points at, and every test
// still exercises the REAL function under test — only the DB boundary is
// replaced.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
