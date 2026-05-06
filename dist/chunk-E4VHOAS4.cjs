"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }

var _chunkZFR3HIOOcjs = require('./chunk-ZFR3HIOO.cjs');



var _chunkZZK7GFOCcjs = require('./chunk-ZZK7GFOC.cjs');


var _chunkWDBYORVZcjs = require('./chunk-WDBYORVZ.cjs');

// src/job-runner/runner.ts
var _pgboss = require('pg-boss'); var _pgboss2 = _interopRequireDefault(_pgboss);
var _postgres = require('postgres'); var _postgres2 = _interopRequireDefault(_postgres);
var _postgresjs = require('drizzle-orm/postgres-js');
var _drizzleorm = require('drizzle-orm');

// src/job-runner/ssh.ts
var _ssh2 = require('ssh2');
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
  const conn = new (0, _ssh2.Client)();
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
  const flushInterval = _nullishCoalesce(config.logFlushIntervalMs, () => ( 1500));
  const boss = new (0, _pgboss2.default)({ connectionString: config.databaseUrl });
  const pgClient = _postgres2.default.call(void 0, config.databaseUrl, { max: 3 });
  const db = _postgresjs.drizzle.call(void 0, pgClient);
  boss.on("error", (err) => console.error("[llm-job-runner] pg-boss error:", err));
  async function processJob(pgBossJob) {
    const { jobId, prompt } = pgBossJob.data;
    const [row] = await db.select({ name: _chunkWDBYORVZcjs.llmJobs.name }).from(_chunkWDBYORVZcjs.llmJobs).where(_drizzleorm.eq.call(void 0, _chunkWDBYORVZcjs.llmJobs.id, jobId)).limit(1);
    const jobName = _nullishCoalesce(_optionalChain([row, 'optionalAccess', _ => _.name]), () => ( "unknown"));
    const log = _chunkZFR3HIOOcjs.logger.child({ job: jobName, job_id: jobId });
    const start = process.hrtime.bigint();
    log.info("job_started");
    await db.update(_chunkWDBYORVZcjs.llmJobs).set({ status: "running", startedAt: /* @__PURE__ */ new Date() }).where(_drizzleorm.eq.call(void 0, _chunkWDBYORVZcjs.llmJobs.id, jobId));
    let buffer = "";
    let lastFlush = Date.now();
    const flush = async () => {
      if (buffer.length === 0) return;
      const pending = buffer;
      buffer = "";
      lastFlush = Date.now();
      await db.update(_chunkWDBYORVZcjs.llmJobs).set({ log: _drizzleorm.sql`${_chunkWDBYORVZcjs.llmJobs.log} || ${pending}` }).where(_drizzleorm.eq.call(void 0, _chunkWDBYORVZcjs.llmJobs.id, jobId));
    };
    const recordOutcome = async (status, exitCode, error) => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      _chunkZZK7GFOCcjs.jobsTotal.inc({ job: jobName, status });
      _chunkZZK7GFOCcjs.jobDurationSeconds.observe({ job: jobName, status }, duration);
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
          await recordOutcome(status, _nullishCoalesce(exitCode, () => ( null)), _nullishCoalesce(error, () => ( null)));
          await db.update(_chunkWDBYORVZcjs.llmJobs).set({
            status,
            exitCode: _nullishCoalesce(exitCode, () => ( null)),
            error: _nullishCoalesce(error, () => ( null)),
            finishedAt: /* @__PURE__ */ new Date()
          }).where(_drizzleorm.eq.call(void 0, _chunkWDBYORVZcjs.llmJobs.id, jobId));
        }
      });
    } catch (err) {
      await flush();
      const msg = err instanceof Error ? err.message : String(err);
      await recordOutcome("failed", null, msg);
      await db.update(_chunkWDBYORVZcjs.llmJobs).set({
        status: "failed",
        error: msg,
        finishedAt: /* @__PURE__ */ new Date()
      }).where(_drizzleorm.eq.call(void 0, _chunkWDBYORVZcjs.llmJobs.id, jobId));
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
      const [row] = await db.insert(_chunkWDBYORVZcjs.llmJobs).values({
        name: options.name,
        prompt: options.prompt,
        status: "pending"
      }).returning({ id: _chunkWDBYORVZcjs.llmJobs.id });
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
        const [row] = await db.insert(_chunkWDBYORVZcjs.llmJobs).values({
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
      const rows = await db.select().from(_chunkWDBYORVZcjs.llmJobs).where(_drizzleorm.eq.call(void 0, _chunkWDBYORVZcjs.llmJobs.id, id)).limit(1);
      return _nullishCoalesce(rows[0], () => ( null));
    },
    async listJobs(options) {
      return db.select().from(_chunkWDBYORVZcjs.llmJobs).orderBy(_drizzleorm.desc.call(void 0, _chunkWDBYORVZcjs.llmJobs.createdAt)).limit(_nullishCoalesce(_optionalChain([options, 'optionalAccess', _2 => _2.limit]), () => ( 50)));
    }
  };
}



exports.createJobRunner = createJobRunner;
