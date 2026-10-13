import { describe, expect, it } from "vitest";
import { loadGenerated } from "../utils/helpers.ts";

const { output, env } = await loadGenerated("inference");

describe("type inference", () => {
  it("infers numbers, booleans and floats", () => {
    expect(env.PORT).toBe(3000);
    expect(env.DEBUG).toBe(true);
    expect(env.FEATURE_FLAG).toBe(false);
    expect(env.FLOAT).toBe(3.14);
    expect(typeof env.APP_NAME).toBe("string");
  });

  it("infers typed JSON", () => {
    expect(env.JSON_ARRAY).toEqual(["a", "b", "c"]);
    expect(env.JSON_OBJECT).toEqual({ key: "value", n: 1 });
  });

  it("infers uuid, url and email", () => {
    expect(output).toMatch(/APP_ID: z\.uuid\(\)/);
    expect(output).toMatch(/API_URL: z\.url\(\)/);
    expect(output).toMatch(/ADMIN_EMAIL: z\.email\(\)/);
  });

  it("infers dates and IP addresses", () => {
    expect(output).toMatch(/RELEASE_DATE: z\.iso\.date\(\)/);
    expect(output).toMatch(/BUILD_TIMESTAMP: z\.iso\.datetime\(\)/);
    expect(output).toMatch(/BIND_HOST_IPV4: z\.ipv4\(\)/);
    expect(output).toMatch(/BIND_HOST_IPV6: z\.ipv6\(\)/);
    expect(env.RELEASE_DATE).toBe("2026-01-31");
    expect(env.BUILD_TIMESTAMP).toBe("2026-01-31T10:00:00Z");
    expect(env.BIND_HOST_IPV4).toBe("192.168.0.1");
    expect(env.BIND_HOST_IPV6).toBe("::1");
  });

  it("supports explicit @type date, datetime, ipv4 and ipv6", () => {
    expect(output).toMatch(/CUSTOM_DATE: z\.iso\.date\(\)/);
    expect(output).toMatch(/CUSTOM_DATETIME: z\.iso\.datetime\(\)/);
    expect(output).toMatch(/CUSTOM_IPV4: z\.ipv4\(\)/);
    expect(output).toMatch(/CUSTOM_IPV6: z\.ipv6\(\)/);
  });

  it("infers CIDR blocks and MAC addresses", () => {
    expect(output).toMatch(/ALLOWED_CIDR: z\.cidrv4\(\)/);
    expect(output).toMatch(/VPC_V6: z\.cidrv6\(\)/);
    expect(output).toMatch(/DEVICE_MAC: z\.mac\(\)/);
    expect(env.ALLOWED_CIDR).toBe("10.0.0.0/8");
    expect(env.VPC_V6).toBe("2001:db8::/32");
    expect(env.DEVICE_MAC).toBe("00:1A:2B:3C:4D:5E");
  });

  it("supports explicit @type cidrv4, cidrv6 and mac(-)", () => {
    expect(output).toMatch(/CUSTOM_CIDRV4: z\.cidrv4\(\)/);
    expect(output).toMatch(/CUSTOM_CIDRV6: z\.cidrv6\(\)/);
    expect(output).toMatch(/DASH_MAC: z\.mac\(\{ delimiter: "-" \}\)/);
    expect(env.CUSTOM_CIDRV4).toBe("192.168.1.0/24");
    expect(env.CUSTOM_CIDRV6).toBe("fe80::/64");
    expect(env.DASH_MAC).toBe("00-1A-2B-3C-4D-5E");
  });
});
