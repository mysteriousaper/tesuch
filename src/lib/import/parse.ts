import Papa from "papaparse";
import { isBlank, type RawCell } from "./normalize";

export interface RawTable {
  headers: string[];
  /** rowNumber is 1-based as the user sees it in Excel (the header row is usually row 1). */
  rows: { rowNumber: number; cells: RawCell[] }[];
}

/** Parse CSV text. Delimiter is auto-detected (Russian/Armenian Excel often exports with ";"). */
export function parseCsv(text: string): RawCell[][] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false, delimitersToGuess: [",", ";", "\t", "|"] });
  return result.data;
}

/** First non-empty row is the header; fully blank rows are dropped but row numbers are kept. */
export function toTable(grid: RawCell[][]): RawTable {
  const headerIdx = grid.findIndex((r) => r.some((c) => !isBlank(c)));
  if (headerIdx === -1) return { headers: [], rows: [] };
  const headers = grid[headerIdx].map((c) => (isBlank(c) ? "" : String(c).trim()));
  const rows = grid
    .slice(headerIdx + 1)
    .map((cells, i) => ({ rowNumber: headerIdx + i + 2, cells }))
    .filter((r) => r.cells.some((c) => !isBlank(c)));
  return { headers, rows };
}
