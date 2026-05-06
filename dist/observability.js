import "./chunk-MLKGABMK.js";

// src/observability/middleware.ts
import { createMiddleware } from "@tanstack/react-start";
function tryGetRoute(result, fallback) {
  try {
    const r = result;
    if (r?.context?.matchedRouteId) return r.context.matchedRouteId;
  } catch {
  }
  return fallback;
}
var loggingMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request, pathname }) => {
    const { logger } = await import("./logger-YEK7GN4X.js");
    const { httpRequestsTotal, httpRequestDurationSeconds } = await import("./metrics-GILTHZM7.js");
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
          duration_ms: Math.round(duration * 1e3)
        },
        "http_request"
      );
      return result;
    } catch (err) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestsTotal.inc({ method, route: "unknown", status: 500 });
      httpRequestDurationSeconds.observe(
        { method, route: "unknown", status: 500 },
        duration
      );
      logger.error(
        {
          method,
          path: pathname,
          err,
          duration_ms: Math.round(duration * 1e3)
        },
        "http_request_failed"
      );
      throw err;
    }
  }
);
export {
  loggingMiddleware
};
