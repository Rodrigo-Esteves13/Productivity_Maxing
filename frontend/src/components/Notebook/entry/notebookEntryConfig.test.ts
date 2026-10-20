import { describe, expect, it } from 'vitest';
import { toLinkUrl } from './notebookEntryConfig';

describe('toLinkUrl', () => {
  it('adds https:// to a bare domain', () => {
    expect(toLinkUrl('example.com/syllabus.pdf')).toBe('https://example.com/syllabus.pdf');
  });

  it('keeps http and https links as they are', () => {
    expect(toLinkUrl('http://moodle.uni.pt/course?id=3')).toBe('http://moodle.uni.pt/course?id=3');
  });

  it('accepts an IPv4 host', () => {
    expect(toLinkUrl('http://192.168.1.10:8080/lab')).toBe('http://192.168.1.10:8080/lab');
  });

  it('refuses what the backend would refuse', () => {
    expect(toLinkUrl('javascript:alert(1)')).toBeNull();
    expect(toLinkUrl('localhost:3000')).toBeNull();
    expect(toLinkUrl('not a url')).toBeNull();
    expect(toLinkUrl(`https://example.com/${'a'.repeat(2000)}`)).toBeNull();
  });
});
