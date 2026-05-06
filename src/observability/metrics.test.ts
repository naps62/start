import { describe, expect, it, beforeEach } from "vitest";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  jobsTotal,
  jobDurationSeconds,
  register,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  it("http_requests_total increments with {method, route, status}", async () => {
    httpRequestsTotal.inc({ method: "GET", route: "/foo", status: 200 });
    httpRequestsTotal.inc({ method: "GET", route: "/foo", status: 200 });
    const text = await register.getSingleMetricAsString("http_requests_total");
    expect(text).toContain('http_requests_total{method="GET",route="/foo",status="200"} 2');
  });

  it("http_request_duration_seconds observes into buckets", async () => {
    httpRequestDurationSeconds.observe({ method: "GET", route: "/foo", status: 200 }, 0.003);
    const text = await register.getSingleMetricAsString("http_request_duration_seconds");
    expect(text).toContain('http_request_duration_seconds_bucket{le="0.005",method="GET",route="/foo",status="200"} 1');
  });

  it("jobs_total increments with {job, status}", async () => {
    jobsTotal.inc({ job: "snapshot", status: "success" });
    const text = await register.getSingleMetricAsString("jobs_total");
    expect(text).toContain('jobs_total{job="snapshot",status="success"} 1');
  });

  it("job_duration_seconds observes with job-appropriate buckets", async () => {
    jobDurationSeconds.observe({ job: "snapshot", status: "success" }, 45);
    const text = await register.getSingleMetricAsString("job_duration_seconds");
    // 45s should land in the 60s bucket
    expect(text).toContain('job_duration_seconds_bucket{le="60",job="snapshot",status="success"} 1');
  });

  it("default node metrics are registered once", async () => {
    expect(register.getSingleMetric("nodejs_version_info")).toBeDefined();
  });
});
