"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }require('./chunk-75ZPJI57.cjs');

// src/observability/middleware.ts
var _reactstart = require('@tanstack/react-start');
function tryGetRoute(result, fallback) {
  try {
    const r = result;
    if (_optionalChain([r, 'optionalAccess', _ => _.context, 'optionalAccess', _2 => _2.matchedRouteId])) return r.context.matchedRouteId;
  } catch (e) {
  }
  return fallback;
}
var loggingMiddleware = _reactstart.createMiddleware.call(void 0, { type: "request" }).server(
  async ({ next, request, pathname }) => {
    const { logger } = await Promise.resolve().then(() => _interopRequireWildcard(require("./logger-FEGK5OL7.cjs")));
    const { httpRequestsTotal, httpRequestDurationSeconds } = await Promise.resolve().then(() => _interopRequireWildcard(require("./metrics-36E6LWFX.cjs")));
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


exports.loggingMiddleware = loggingMiddleware;
