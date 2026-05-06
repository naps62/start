import { createMiddleware } from "@tanstack/react-start";

/**
 * Attempt to extract a low-cardinality route id from the request middleware
 * result context. TanStack Start does not guarantee a matched route id here,
 * so we fall back to "unknown" rather than using the raw path (which would
 * explode cardinality on parameterised routes).
 */
function tryGetRoute(result: unknown, fallback: string): string {
  try {
    const r = result as { context?: { matchedRouteId?: string } } | undefined;
    if (r?.context?.matchedRouteId) return r.context.matchedRouteId;
  } catch {
    // ignore
  }
  return fallback;
}

// The `.server(...)` callback only runs server-side. Imports for logger
// and metrics live INSIDE the callback so the module's top-level import
// graph stays client-safe — the client bundle never loads pino, prom-client,
// or node:net.
export const loggingMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request, pathname }) => {
    const { logger } = await import("./logger");
    const { httpRequestsTotal, httpRequestDurationSeconds } = await import(
      "./metrics"
    );

    const start = process.hrtime.bigint();
    const method = request.method;

    try {
      const result = await next();
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      const status = result.response.status;
      const route = tryGetRoute(result, "unknown");

      httpRequestsTotal.inc({ method, route, status });
      httpRequestDurationSeconds.observe({ method, route, status }, duration);
      logger.info(
        {
          method,
          path: pathname,
          route,
          status,
          duration_ms: Math.round(duration * 1000),
        },
        "http_request",
      );
      return result;
    } catch (err) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestsTotal.inc({ method, route: "unknown", status: 500 });
      httpRequestDurationSeconds.observe(
        { method, route: "unknown", status: 500 },
        duration,
      );
      logger.error(
        {
          method,
          path: pathname,
          err,
          duration_ms: Math.round(duration * 1000),
        },
        "http_request_failed",
      );
      throw err;
    }
  },
);
