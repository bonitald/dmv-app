import { readFileSync } from 'node:fs';

export function readJsonFile(jsonPath: string): unknown {
  const raw = readFileSync(jsonPath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse JSON from "${jsonPath}": ${(error as Error).message}`);
  }
}
