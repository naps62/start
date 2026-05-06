import {
  logger
} from "./chunk-THZKQPHU.js";
import {
  jobDurationSeconds,
  jobsTotal
} from "./chunk-Q4Q4AQL5.js";
import {
  llmJobs
} from "./chunk-65CQECWX.js";

// src/job-runner/runner.ts
import PgBoss from "pg-boss";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, sql as dsql } from "drizzle-orm";

// src/job-runner/ssh.ts
import { Client } from "ssh2";
function parseHost(hostStr) {
  let username = "root";
  let host = hostStr;
  let port = 22;
  if (host.includes("@")) {
    const parts = host.split("@");
    username = parts[0];
    host = parts[1];
  }
  if (host.includes(":")) {
    const parts = host.split(":");
    host = parts[0];
    port = parseInt(parts[1], 10);
  }
  return { username, host, port };
}
function preparePrivateKey(raw) {
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n");
  if (!key.endsWith("\n")) key += "\n";
  return key;
}
function executeSshJob(config, prompt, callbacks) {
  const shellEscapedPrompt = prompt.replace(/'/g, `'\\''`);
  const remoteCmd = `cd ${config.repoPath} && set -a && [ -f .env ] && . ./.env; set +a && export PATH="$HOME/.local/bin:$PATH" && claude --print --dangerously-skip-permissions '${shellEscapedPrompt}'`;
  const { username, host, port } = parseHost(config.host);
  const conn = new Client();
  const connectOpts = {
    host,
    port,
    username,
    keepaliveInterval: 3e4
  };
  if (config.privateKey) {
    connectOpts.privateKey = preparePrivateKey(config.privateKey);
  }
  return new Promise((resolve) => {
    conn.on("ready", () => {
      conn.exec(remoteCmd, (err, stream) => {
        if (err) {
          void Promise.resolve(callbacks.onDone(null, err.message)).then(() => {
            conn.end();
            resolve();
          });
          return;
        }
        stream.on("data", (d) => {
          void callbacks.onChunk(d.toString());
        });
        stream.stderr.on("data", (d) => {
          void callbacks.onChunk(d.toString());
        });
        stream.on("close", (code) => {
          void Promise.resolve(callbacks.onDone(code)).then(() => {
            conn.end();
            resolve();
          });
        });
      });
    });
    conn.on("error", (err) => {
      void Promise.resolve(callbacks.onDone(null, err.message)).then(
        () => resolve()
      );
    });
    conn.connect(connectOpts);
  });
}

// src/job-runner/runner.ts
var QUEUE_NAME = "llm-job";
function createJobRunner(config) {
  const flushInterval = config.logFlushIntervalMs ?? 1500;
  const boss = new PgBoss({ connectionString: config.databaseUrl });
  const pgClient = postgres(config.databaseUrl, { max: 3 });
  const db = drizzle(pgClient);
  boss.on("error", (err) => console.error("[llm-job-runner] pg-boss error:", err));
  async function processJob(pgBossJob) {
    const { jobId, prompt } = pgBossJob.data;
    const [row] = await db.select({ name: llmJobs.name }).from(llmJobs).where(eq(llmJobs.id, jobId)).limit(1);
    const jobName = row?.name ?? "unknown";
    const log = logger.child({ job: jobName, job_id: jobId });
    const start = process.hrtime.bigint();
    log.info("job_started");
    await db.update(llmJobs).set({ status: "running", startedAt: /* @__PURE__ */ new Date() }).where(eq(llmJobs.id, jobId));
    let buffer = "";
    let lastFlush = Date.now();
    const flush = async () => {
      if (buffer.length === 0) return;
      const pending = buffer;
      buffer = "";
      lastFlush = Date.now();
      await db.update(llmJobs).set({ log: dsql`${llmJobs.log} || ${pending}` }).where(eq(llmJobs.id, jobId));
    };
    const recordOutcome = async (status, exitCode, error) => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      jobsTotal.inc({ job: jobName, status });
      jobDurationSeconds.observe({ job: jobName, status }, duration);
      if (status === "success") {
        log.info({ duration_ms: Math.round(duration * 1e3) }, "job_completed");
      } else {
        log.error(
          { duration_ms: Math.round(duration * 1e3), exit_code: exitCode, error },
          "job_failed"
        );
      }
    };
    try {
      await executeSshJob(config.ssh, prompt, {
        onChunk: async (chunk) => {
          buffer += chunk;
          if (Date.now() - lastFlush > flushInterval) {
            await flush();
          }
        },
        onDone: async (exitCode, error) => {
          await flush();
          const status = exitCode === 0 ? "success" : "failed";
          await recordOutcome(status, exitCode ?? null, error ?? null);
          await db.update(llmJobs).set({
            status,
            exitCode: exitCode ?? null,
            error: error ?? null,
            finishedAt: /* @__PURE__ */ new Date()
          }).where(eq(llmJobs.id, jobId));
        }
      });
    } catch (err) {
      await flush();
      const msg = err instanceof Error ? err.message : String(err);
      await recordOutcome("failed", null, msg);
      await db.update(llmJobs).set({
        status: "failed",
        error: msg,
        finishedAt: /* @__PURE__ */ new Date()
      }).where(eq(llmJobs.id, jobId));
      throw err;
    }
  }
  return {
    async start() {
      await boss.start();
      await boss.createQueue(QUEUE_NAME);
      await boss.work(QUEUE_NAME, async ([job]) => {
        await processJob(job);
      });
    },
    async stop() {
      await boss.stop();
      await pgClient.end();
    },
    async enqueue(options) {
      const [row] = await db.insert(llmJobs).values({
        name: options.name,
        prompt: options.prompt,
        status: "pending"
      }).returning({ id: llmJobs.id });
      await boss.send(QUEUE_NAME, {
        jobId: row.id,
        prompt: options.prompt
      });
      return row.id;
    },
    async schedule(options) {
      const scheduleName = `llm-schedule-${options.name}`;
      await boss.schedule(scheduleName, options.cron, {
        name: options.name,
        prompt: options.prompt
      });
      await boss.createQueue(scheduleName);
      await boss.work(scheduleName, async ([job]) => {
        const [row] = await db.insert(llmJobs).values({
          name: job.data.name,
          prompt: job.data.prompt,
          status: "pending"
        }).returning();
        await processJob({
          ...job,
          data: { jobId: row.id, prompt: job.data.prompt }
        });
      });
    },
    async getJob(id) {
      const rows = await db.select().from(llmJobs).where(eq(llmJobs.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async listJobs(options) {
      return db.select().from(llmJobs).orderBy(desc(llmJobs.createdAt)).limit(options?.limit ?? 50);
    }
  };
}

export {
  createJobRunner
};
