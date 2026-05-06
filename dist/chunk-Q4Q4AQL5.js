// src/observability/metrics.ts
import { collectDefaultMetrics, Counter, Histogram, register } from "prom-client";
if (!register.getSingleMetric("nodejs_version_info")) {
  collectDefaultMetrics();
}
var httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"]
});
var httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [1e-3, 5e-3, 0.01, 0.05, 0.1, 0.5, 1, 5]
});
var jobsTotal = new Counter({
  name: "jobs_total",
  help: "Total pg-boss jobs processed",
  labelNames: ["job", "status"]
});
var jobDurationSeconds = new Histogram({
  name: "job_duration_seconds",
  help: "pg-boss job duration in seconds",
  labelNames: ["job", "status"],
  buckets: [0.1, 0.5, 1, 5, 30, 60, 300, 600, 1800]
});

export {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  jobsTotal,
  jobDurationSeconds
};
