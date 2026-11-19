// Staff import: raw grid → table → column mapping (auto + user overrides) → validated insert rows.
// Excel readers live in ./xlsx-node and ./xlsx-browser so each runtime only bundles its own entry.
export { FIELD_ALIASES, TARGET_FIELDS, normalizeHeader, type TargetField } from "./fields";
export { autoMap, missingRequiredFields, toMapping, type ColumnGuess, type ColumnMapping } from "./mapping";
export { excelSerialToIso, parseBool, parseContractType, parseDate, parseGround, parseInitiator, type RawCell } from "./normalize";
export { parseCsv, toTable, type RawTable } from "./parse";
export { buildImport, type ContractInsert, type EmployeeInsert, type ImportError, type ImportErrorKey, type ImportResult, OPTIONAL_FIELD_IMPACT, unmappedImpact } from "./pipeline";
export { armsoftPreset, presetField } from "./presets";
