import { describe, expect, it } from "vitest";
import { supportLinks } from "./support";

describe("supportLinks", () => {
  it("is hidden when the email is unset, blank or invalid", () => {
    expect(supportLinks(undefined)).toBeNull();
    expect(supportLinks("  ")).toBeNull();
    expect(supportLinks("not-an-email")).toBeNull();
  });
  it("builds mailto, and a Telegram link only for a valid bot name", () => {
    expect(supportLinks("help@example.com")).toEqual({ email: "help@example.com", mailto: "mailto:help@example.com", telegram: null });
    expect(supportLinks("help@example.com", "@TesuchHelpBot")?.telegram).toBe("https://t.me/TesuchHelpBot");
    expect(supportLinks("help@example.com", "TesuchHelpBot")?.telegram).toBe("https://t.me/TesuchHelpBot");
    expect(supportLinks("help@example.com", "bad name!")?.telegram).toBeNull();
    expect(supportLinks("help@example.com", "abc")?.telegram).toBeNull();
  });
});
