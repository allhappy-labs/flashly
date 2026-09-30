export function parseDelimitedText(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(value);
      value = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      row.push(value);
      value = '';
      rows.push(row);
      row = [];
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length > 0 && rows[0].length > 0) {
    rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  }

  return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0));
}

export function buildDelimitedText(rows: string[][], delimiter: string): string {
  return rows
    .map((row) => row.map((value) => escapeDelimitedValue(value, delimiter)).join(delimiter))
    .join('\n');
}

function escapeDelimitedValue(value: string, delimiter: string): string {
  if (
    value.includes('"')
    || value.includes('\n')
    || value.includes('\r')
    || value.includes(delimiter)
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));
  return normalizedHeaders.findIndex((header) => normalizedAliases.includes(header));
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

