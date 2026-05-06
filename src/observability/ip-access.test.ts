import { describe, expect, it } from "vitest";
import { isLocalNetworkIp, isAllowed } from "./ip-access";

describe("isLocalNetworkIp", () => {
  it.each([
    ["127.0.0.1", true],
    ["127.255.255.254", true],
    ["10.0.0.1", true],
    ["10.255.255.254", true],
    ["172.16.0.1", true],
    ["172.31.255.254", true],
    ["172.15.0.1", false],
    ["172.32.0.1", false],
    ["192.168.1.1", true],
    ["192.168.255.254", true],
    ["192.167.0.1", false],
    ["8.8.8.8", false],
    ["::1", true],
    ["::ffff:10.0.0.1", true],
    ["::ffff:8.8.8.8", false],
    ["not-an-ip", false],
    ["", false],
  ])("%s → %s", (ip, expected) => {
    expect(isLocalNetworkIp(ip)).toBe(expected);
  });
});

describe("isAllowed", () => {
  it("empty allowlist falls back to RFC1918", () => {
    expect(isAllowed("10.0.0.1", [])).toBe(true);
    expect(isAllowed("8.8.8.8", [])).toBe(false);
  });

  it("non-empty allowlist only matches listed IPs exactly", () => {
    expect(isAllowed("10.1.2.3", ["10.1.2.3"])).toBe(true);
    expect(isAllowed("10.0.0.1", ["10.1.2.3"])).toBe(false);
  });
});
