import { describe, it, expect } from 'vitest';
import { hash, fileFingerprint } from '../src/utils/hash';

describe('hash', () => {
  it('is deterministic for identical input', () => {
    expect(hash('hello world')).toBe(hash('hello world'));
  });

  it('produces different hashes for different content', () => {
    expect(hash('hello world')).not.toBe(hash('hello world!'));
  });

  it('returns a short hex string', () => {
    const h = hash('anything');
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('fileFingerprint', () => {
  it('is deterministic for identical content + mtime', () => {
    expect(fileFingerprint('abc', 1000)).toBe(fileFingerprint('abc', 1000));
  });

  it('differs when content differs', () => {
    expect(fileFingerprint('abc', 1000)).not.toBe(fileFingerprint('abd', 1000));
  });

  it('differs when mtime differs', () => {
    expect(fileFingerprint('abc', 1000)).not.toBe(fileFingerprint('abc', 2000));
  });
});
