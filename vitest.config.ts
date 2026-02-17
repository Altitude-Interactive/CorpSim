import os from "node:os";
import { defineConfig } from "vitest/config";

const maxThreads = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads
      }
    }
  }
});
