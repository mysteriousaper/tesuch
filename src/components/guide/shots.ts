/** Real screenshots of the Armenian interface with fictional demo data (public/guide/*.webp, 1280px wide captures). */
export interface Shot {
  src: string;
  width: number;
  height: number;
}

/** Screenshots per step, in step order. The alt text of each lives in messages/<locale>/guide.json (how.steps[i].alts). */
export const STEP_SHOTS: Shot[][] = [
  [{ src: "/guide/sign-in.webp", width: 600, height: 300 }],
  [{ src: "/guide/terms.webp", width: 680, height: 999 }],
  [{ src: "/guide/firm.webp", width: 1280, height: 310 }],
  [{ src: "/guide/import.webp", width: 1280, height: 670 }],
  [
    { src: "/guide/dashboard.webp", width: 1280, height: 630 },
    { src: "/guide/issues.webp", width: 1280, height: 640 },
  ],
  [{ src: "/guide/fix.webp", width: 768, height: 576 }],
  [{ src: "/guide/telegram.webp", width: 700, height: 225 }],
  [{ src: "/guide/documents.webp", width: 1280, height: 690 }],
  [{ src: "/guide/team.webp", width: 1280, height: 690 }],
  [{ src: "/guide/quiz.webp", width: 1280, height: 690 }],
];

/** Telegram bot commands are literal text in every language. */
export const BOT_COMMANDS = [
  { cmd: "/status", key: "status" },
  { cmd: "/issues", key: "issues" },
  { cmd: "/issues 2", key: "issuesN" },
  { cmd: "/help", key: "help" },
  { cmd: "/stop", key: "stop" },
] as const;
