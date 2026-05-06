// Client-safe barrel: only the middleware is exported here because `start.ts`
// sits in the client bundle (TanStack Start treats it as reachable from both
// environments) and anything else in this module loads pino / prom-client /
// node:net. The middleware's `.server(...)` callback lazily imports those
// server-only modules, so this barrel stays browser-safe.
export { loggingMiddleware } from "./middleware";
