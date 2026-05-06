"use strict";Object.defineProperty(exports, "__esModule", {value: true});// src/observability/metrics.ts
var _promclient = require('prom-client');
if (!_promclient.register.getSingleMetric("nodejs_version_info")) {
  _promclient.collectDefaultMetrics.call(void 0, );
}
var httpRequestsTotal = new (0, _promclient.Counter)({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"]
});
var httpRequestDurationSeconds = new (0, _promclient.Histogram)({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [1e-3, 5e-3, 0.01, 0.05, 0.1, 0.5, 1, 5]
});
var jobsTotal = new (0, _promclient.Counter)({
  name: "jobs_total",
  help: "Total pg-boss jobs processed",
  labelNames: ["job", "status"]
});
var jobDurationSeconds = new (0, _promclient.Histogram)({
  name: "job_duration_seconds",
  help: "pg-boss job duration in seconds",
  labelNames: ["job", "status"],
  buckets: [0.1, 0.5, 1, 5, 30, 60, 300, 600, 1800]
});







exports.register = _promclient.register; exports.httpRequestsTotal = httpRequestsTotal; exports.httpRequestDurationSeconds = httpRequestDurationSeconds; exports.jobsTotal = jobsTotal; exports.jobDurationSeconds = jobDurationSeconds;
