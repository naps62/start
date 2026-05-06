"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }// src/observability/logger.ts
var _pino = require('pino'); var _pino2 = _interopRequireDefault(_pino);
var isDev = process.env.NODE_ENV !== "production";
var options = {
  level: _nullishCoalesce(process.env.LOG_LEVEL, () => ( (isDev ? "debug" : "info"))),
  formatters: {
    level: (label) => ({ level: label })
  },
  messageKey: "message",
  timestamp: () => `,"timestamp":"${(/* @__PURE__ */ new Date()).toISOString()}"`,
  base: {
    service: _nullishCoalesce(process.env.SERVICE_NAME, () => ( "app")),
    env: _nullishCoalesce(process.env.NODE_ENV, () => ( "development"))
  },
  ...isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss.l" }
    }
  },
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.secret",
      "*.authorization",
      "*.cookie",
      "req.headers.authorization",
      "req.headers.cookie"
    ],
    censor: "[redacted]"
  }
};
var logger = isDev ? _pino2.default.call(void 0, options) : _pino2.default.call(void 0, options, process.stdout);



exports.logger = logger;
