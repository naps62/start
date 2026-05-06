// Server-only observability barrel. Import this from `.server.ts` files or
// from `server.handlers.*` callbacks in TanStack Start routes. It pulls in
// pino, prom-client, and node:net — never safe to import from client code.

export { logger } from "./logger";
export type { Logger } from "./logger";
export {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  jobsTotal,
  jobDurationSeconds,
  register,
} from "./metrics";
export { isLocalNetworkIp, isAllowed } from "./ip-access";
