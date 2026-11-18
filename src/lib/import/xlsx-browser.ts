// Browser entry for Excel files (the mapping wizard reads the file client-side).
import { readSheet } from "read-excel-file/browser";
import type { RawCell } from "./normalize";

export async function readXlsxGrid(file: File | Blob | ArrayBuffer, sheet: number | string = 1): Promise<RawCell[][]> {
  const data = await readSheet(file, sheet);
  return data as unknown as RawCell[][];
}
