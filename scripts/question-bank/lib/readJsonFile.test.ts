import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonFile } from './readJsonFile';

function writeTempFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'read-json-file-test-'));
  const filePath = join(dir, 'data.json');
  writeFileSync(filePath, contents);
  return filePath;
}

describe('readJsonFile', () => {
  it('parses a valid JSON file', () => {
    const filePath = writeTempFile(JSON.stringify({ foo: 'bar' }));
    expect(readJsonFile(filePath)).toEqual({ foo: 'bar' });
  });

  it('throws an error including the file path for malformed JSON', () => {
    const filePath = writeTempFile('{ not valid json');
    expect(() => readJsonFile(filePath)).toThrow(filePath);
  });
});
