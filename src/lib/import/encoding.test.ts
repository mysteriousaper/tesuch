import { describe, expect, it } from "vitest";
import { decodeCsv } from "./encoding";

// windows-1251 bytes for "Имя;Дата": И=C8 м=EC я=FF ; Д=C4 а=E0 т=F2 а=E0
const CP1251 = new Uint8Array([0xc8, 0xec, 0xff, 0x3b, 0xc4, 0xe0, 0xf2, 0xe0]);

describe("decodeCsv", () => {
  it("decodes UTF-8 Armenian text", () => {
    const bytes = new TextEncoder().encode("Անուն Ազգանուն;Ծննդյան ամսաթիվ");
    expect(decodeCsv(bytes)).toEqual({ text: "Անուն Ազգանուն;Ծննդյան ամսաթիվ", encoding: "utf-8", fellBack: false });
  });

  it("strips a UTF-8 BOM", () => {
    const body = new TextEncoder().encode("Имя;Дата");
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...body]);
    expect(decodeCsv(bytes).text).toBe("Имя;Дата");
  });

  it("falls back to windows-1251 for invalid UTF-8", () => {
    expect(decodeCsv(CP1251.buffer)).toEqual({ text: "Имя;Дата", encoding: "windows-1251", fellBack: true });
  });

  it("honours a forced encoding both ways", () => {
    expect(decodeCsv(CP1251, "windows-1251")).toMatchObject({ text: "Имя;Дата", encoding: "windows-1251", fellBack: false });
    const utf8 = new TextEncoder().encode("Имя");
    const forced = decodeCsv(utf8, "windows-1251");
    expect(forced.text).not.toBe("Имя");
    expect(decodeCsv(utf8, "utf-8").text).toBe("Имя");
    expect(decodeCsv(CP1251, "utf-8").text).toContain("�");
  });
});
