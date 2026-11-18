// Server/Node entry for Excel files (route handlers, scripts, tests).
import { readSheet } from "read-excel-file/node";
import type { RawCell } from "./normalize";

export async function readXlsxGrid(input: Buffer | string, sheet: number | string = 1): Promise<RawCell[][]> {
  const data = await readSheet(input, sheet);
  return data as unknown as RawCell[][];
}
