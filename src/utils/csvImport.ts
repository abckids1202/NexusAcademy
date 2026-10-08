export type CsvWheelOption = { label: string; weight: number; line: number };
export type CsvOptionError = { line: number; message: string };
export type CsvOptionPreview = {
  options: CsvWheelOption[];
  errors: CsvOptionError[];
  blankRows: number;
  duplicateCount: number;
};
export type CsvParticipantPreview = {
  names: string[];
  errors: CsvOptionError[];
  blankRows: number;
  duplicateCount: number;
};
export type ParticipantCsvInspection = {
  headers: string[];
  dataRows: string[][];
  hasHeader: boolean;
};

export function parseCsvRows(input: string): string[][] {
  const source = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("A quoted CSV field is not closed.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function isHeaderRow(row: string[]): boolean {
  const first = row[0]?.trim().toLocaleLowerCase();
  const second = row[1]?.trim().toLocaleLowerCase();
  return ["option", "label", "entry", "name"].includes(first ?? "") &&
    (!second || ["weight", "chance", "tickets"].includes(second));
}

function isParticipantHeaderRow(row: string[]): boolean {
  const headings = new Set(["participant", "name", "player", "entrant", "email", "group", "team", "notes"]);
  return row.some((value) => headings.has(value.trim().toLocaleLowerCase()));
}

export function inspectParticipantCsv(input: string): ParticipantCsvInspection {
  const rows = parseCsvRows(input);
  const hasHeader = rows.length > 0 && isParticipantHeaderRow(rows[0]);
  const sourceHeaders = hasHeader ? rows[0] : rows[0]?.map((_, index) => `Column ${index + 1}`) ?? [];
  return { headers: sourceHeaders.map((header, index) => header.trim() || `Column ${index + 1}`), dataRows: rows.slice(hasHeader ? 1 : 0), hasHeader };
}

export function parseWheelOptionCsv(input: string): CsvOptionPreview {
  const rows = parseCsvRows(input);
  const startsAt = rows.length > 0 && isHeaderRow(rows[0]) ? 1 : 0;
  const options: CsvWheelOption[] = [];
  const errors: CsvOptionError[] = [];
  let blankRows = 0;
  const seenLabels = new Set<string>();
  let duplicateCount = 0;

  rows.slice(startsAt).forEach((row, index) => {
    const line = startsAt + index + 1;
    const label = (row[0] ?? "").trim();
    const weightText = (row[1] ?? "").trim();
    const extraValues = row.slice(2).some((value) => value.trim().length > 0);

    if (!label && !weightText && !extraValues) {
      blankRows += 1;
      return;
    }
    if (!label) {
      errors.push({ line, message: "Add an option label in the first column." });
      return;
    }
    if (extraValues) {
      errors.push({ line, message: "Use only the label and optional weight columns." });
      return;
    }

    const weight = weightText ? Number(weightText) : 1;
    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push({ line, message: "Weight must be a positive number." });
      return;
    }

    const normalizedLabel = label.toLocaleLowerCase();
    if (seenLabels.has(normalizedLabel)) duplicateCount += 1;
    seenLabels.add(normalizedLabel);
    options.push({ label, weight, line });
  });

  return { options, errors, blankRows, duplicateCount };
}

export function parseParticipantCsvColumn(input: string, columnIndex = 0): CsvParticipantPreview {
  const inspection = inspectParticipantCsv(input);
  const names: string[] = [];
  const errors: CsvOptionError[] = [];
  const seen = new Set<string>();
  let blankRows = 0;
  let duplicateCount = 0;

  inspection.dataRows.forEach((row, index) => {
    const line = (inspection.hasHeader ? 2 : 1) + index;
    const name = (row[columnIndex] ?? "").trim();
    if (row.every((value) => value.trim().length === 0)) {
      blankRows += 1;
      return;
    }
    if (!name) {
      errors.push({ line, message: columnIndex === 0 ? "Add a participant name in the first column." : "Add a participant name in the selected column." });
      return;
    }

    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    names.push(name);
  });

  return { names, errors, blankRows, duplicateCount };
}

export function parseParticipantCsv(input: string): CsvParticipantPreview {
  return parseParticipantCsvColumn(input, 0);
}
