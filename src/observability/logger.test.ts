import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("logger", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Force prod mode so JSON output is deterministic
    process.env.NODE_ENV = "production";
    process.env.SERVICE_NAME = "test-svc";
    delete process.env.LOG_LEVEL;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("emits JSON with string level, ISO timestamp, message, service, env", async () => {
    const { logger } = await import("./logger");
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any) => {
      chunks.push(String(chunk));
      return true;
    };
    try {
      logger.info({ foo: "bar" }, "hello");
    } finally {
      process.stdout.write = origWrite;
    }
    const line = chunks.find((c) => c.includes("hello"));
    expect(line).toBeDefined();
    const parsed = JSON.parse(line!);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello");
    expect(parsed.service).toBe("test-svc");
    expect(parsed.env).toBe("production");
    expect(parsed.foo).toBe("bar");
    expect(typeof parsed.timestamp).toBe("string");
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("redacts authorization and password fields", async () => {
    const { logger } = await import("./logger");
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any) => {
      chunks.push(String(chunk));
      return true;
    };
    try {
      logger.info(
        { req: { headers: { authorization: "Bearer secret123" } }, user: { password: "hunter2" } },
        "req",
      );
    } finally {
      process.stdout.write = origWrite;
    }
    const line = chunks.find((c) => c.includes('"req"'));
    expect(line).toBeDefined();
    expect(line).not.toContain("secret123");
    expect(line).not.toContain("hunter2");
    expect(line).toContain("[redacted]");
  });
});
