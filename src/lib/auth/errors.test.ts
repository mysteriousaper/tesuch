import { describe, expect, it } from "vitest";
import { classifyAuthError } from "./errors";

describe("classifyAuthError", () => {
  it("detects 429 by status", () => expect(classifyAuthError({ status: 429 })).toBe("rateLimited"));
  it("detects rate limit by code", () => expect(classifyAuthError({ code: "over_email_send_rate_limit" })).toBe("rateLimited"));
  it("detects rate limit by message", () => expect(classifyAuthError({ message: "Email rate limit exceeded" })).toBe("rateLimited"));
  it("detects captcha by message", () => expect(classifyAuthError({ status: 400, message: "captcha verification process failed" })).toBe("captcha"));
  it("detects captcha by code", () => expect(classifyAuthError({ code: "captcha_failed" })).toBe("captcha"));
  it("falls back to generic", () => {
    expect(classifyAuthError({ status: 500, message: "boom" })).toBe("generic");
    expect(classifyAuthError(null)).toBe("generic");
  });
});
