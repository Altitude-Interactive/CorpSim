import { afterEach, describe, expect, it } from "vitest";
import { loadWorkerConfig } from "./config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("worker config", () => {
  it("loads BullMQ and Redis defaults", () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_DB;
    delete process.env.REDIS_USERNAME;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_TLS;
    delete process.env.BULLMQ_PREFIX;
    delete process.env.BULLMQ_QUEUE_NAME;
    delete process.env.BULLMQ_SCHEDULER_ENABLED;
    delete process.env.BULLMQ_WORKER_ENABLED;

    const config = loadWorkerConfig();

    expect(config.redis).toMatchObject({
      host: "localhost",
      port: 6379,
      db: 0,
      tlsEnabled: false
    });

    expect(config.bullmq).toMatchObject({
      prefix: "corpsim",
      queueName: "simulation.tick",
      schedulerEnabled: true,
      workerEnabled: true,
      workerConcurrency: 1
    });
  });

  it("throws on invalid BullMQ boolean flag", () => {
    process.env.BULLMQ_WORKER_ENABLED = "not-a-bool";

    expect(() => loadWorkerConfig()).toThrow(
      "BULLMQ_WORKER_ENABLED must be true/false or 1/0"
    );
  });
});
