import type { TargetField } from "./fields";

/**
 * Exact header → field mapping for ArmSoft HR exports.
 * TODO: fill in from a real (anonymised) ArmSoft staff export — requested in docs/INVESTOR_REQUESTS.md.
 * Until then autoMap() handles ArmSoft files like any other spreadsheet.
 */
export const armsoftPreset: Record<string, TargetField> = {};

/** Apply a preset first, then fall back to auto-mapping for headers it does not know. */
export function presetField(preset: Record<string, TargetField>, header: string): TargetField | null {
  return preset[header.trim()] ?? null;
}
