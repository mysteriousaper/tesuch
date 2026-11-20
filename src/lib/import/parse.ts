import Papa from "papaparse";
import { autoMap } from "./mapping";
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

const HEADER_SCAN_ROWS = 15;

const headerCells = (row: RawCell[]): string[] => row.map((c) => (isBlank(c) ? "" : String(c).trim()));

/**
 * Detect the header row: among the first ~15 non-empty rows, the one whose cells match the most known
 * field aliases (earliest wins ties). Falls back to the first non-empty row. Returns a 1-based row
 * number as in Excel, or null when the grid is empty.
 */
export function detectHeaderRow(grid: RawCell[][]): number | null {
  let first: number | null = null;
  let best = 0;
  let bestIdx: number | null = null;
  let seen = 0;
  for (let i = 0; i < grid.length && seen < HEADER_SCAN_ROWS; i++) {
    if (!grid[i].some((c) => !isBlank(c))) continue;
    seen++;
    if (first === null) first = i;
    const matches = autoMap(headerCells(grid[i])).filter((g) => g.field !== null).length;
    if (matches > best) {
      best = matches;
      bestIdx = i;
    }
  }
  const idx = bestIdx ?? first;
  return idx === null ? null : idx + 1;
}

/**
 * Header row is auto-detected unless `headerRow` (1-based, as in Excel) is given. Rows above it are
 * dropped; fully blank rows below are dropped but row numbers are kept.
 */
export function toTable(grid: RawCell[][], opts: { headerRow?: number | null } = {}): RawTable {
  const headerRow = opts.headerRow ?? detectHeaderRow(grid);
  if (headerRow === null || !Number.isInteger(headerRow) || headerRow < 1 || headerRow > grid.length) return { headers: [], rows: [] };
  const headerIdx = headerRow - 1;
  const headers = headerCells(grid[headerIdx]);
  const rows = grid
    .slice(headerIdx + 1)
    .map((cells, i) => ({ rowNumber: headerIdx + i + 2, cells }))
    .filter((r) => r.cells.some((c) => !isBlank(c)));
  return { headers, rows };
}
