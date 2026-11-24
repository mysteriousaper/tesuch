// Legal grounds for an employer-initiated termination, as codes (Labour Code Art. 113(1) points 1-13; Art. 93(1) for probation).
export const GROUND_CODES = [
  "113(1)(1)", "113(1)(2)", "113(1)(3)", "113(1)(4)", "113(1)(5)", "113(1)(6)", "113(1)(7)",
  "113(1)(8)", "113(1)(9)", "113(1)(10)", "113(1)(11)", "113(1)(12)", "113(1)(13)", "93(1)",
] as const;

export type GroundCode = (typeof GROUND_CODES)[number];

export const isGroundCode = (v: unknown): v is GroundCode => typeof v === "string" && (GROUND_CODES as readonly string[]).includes(v);

/** i18n key for a code: "113(1)(3)" -> "113_1_3". */
export const groundKey = (code: string) => code.replace(/\)\(|\(|\)/g, "_").replace(/_$/, "");
