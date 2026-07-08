import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_sessions_token").on(t.token),
    index("idx_sessions_expires").on(t.expires_at),
  ],
);

export const llmJobs = pgTable(
  "llm_jobs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").notNull().default("pending"),
    log: text("log").notNull().default(""),
    exitCode: integer("exit_code"),
    error: text("error"),
    sessionId: text("session_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_llm_jobs_status").on(t.status),
    index("idx_llm_jobs_created").on(t.createdAt),
    check("llm_jobs_status_check", sql`${t.status} IN ('pending','running','success','failed')`),
  ]
);

export type LlmJob = typeof llmJobs.$inferSelect;
