import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import tokens from "../../../design/tokens.json";
import { DEFAULT_THEME } from "@/components/theme/config";
import { RULES } from "@/lib/rules/catalog";

// Social preview card: product name, headline, readiness gauge. Text and shapes only — no people.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tesuch · Տեսուչ";

const c = Object.fromEntries(Object.entries(tokens.themes[DEFAULT_THEME].color).map(([k, v]) => [k, v.light]));
const font = (file: string) => readFile(join(process.cwd(), "public/fonts", file));

const SCORE = 82;
const R = 150;
const ARC = Math.PI * R;

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  const common = await getTranslations({ locale, namespace: "common" });
  const [arm, latin, cyr] = await Promise.all([
    font("noto-sans-armenian-armenian-700-normal.woff"),
    font("noto-sans-latin-700-normal.woff"),
    font("noto-sans-cyrillic-700-normal.woff"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: c.bg, color: c.ink, fontFamily: "NotoLatin, NotoCyr, NotoArm", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: c.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke={c["accent-ink"]} strokeWidth="2.6" strokeLinecap="round">
                <path d="M7 21a9 9 0 0 1 18 0" />
                <path d="M16 21l4.5-5.5" />
              </svg>
            </div>
            <span style={{ fontSize: 34 }}>{common("appName")}</span>
          </div>
          <div style={{ display: "flex", fontSize: 60, lineHeight: 1.12, letterSpacing: -1 }}>{t("hero.title")}</div>
          <div style={{ display: "flex", gap: 14, fontSize: 24, color: c.muted }}>
            <span>{t("stats.rules", { n: RULES.length })}</span>
            <span>·</span>
            <span>hy · ru · en</span>
            <span>·</span>
            <span>{t("stats.eu")}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 380 }}>
          <svg width="360" height="200" viewBox="0 0 360 200">
            <path d={`M30 180 A${R} ${R} 0 0 1 330 180`} fill="none" stroke={c["surface-2"]} strokeWidth="26" strokeLinecap="round" />
            <path
              d={`M30 180 A${R} ${R} 0 0 1 330 180`}
              fill="none"
              stroke={c.ok}
              strokeWidth="26"
              strokeLinecap="round"
              strokeDasharray={`${ARC}`}
              strokeDashoffset={`${ARC * (1 - SCORE / 100)}`}
            />
          </svg>
          <div style={{ display: "flex", marginTop: -92, fontSize: 84, color: c.ink }}>{SCORE}</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 24, color: c.muted, textAlign: "center", justifyContent: "center", maxWidth: 340 }}>{common("score")}</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 12, background: c.accent, display: "flex" }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "NotoLatin", data: latin, weight: 700, style: "normal" },
        { name: "NotoCyr", data: cyr, weight: 700, style: "normal" },
        { name: "NotoArm", data: arm, weight: 700, style: "normal" },
      ],
    },
  );
}
