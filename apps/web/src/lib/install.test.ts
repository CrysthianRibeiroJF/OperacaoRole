import { describe, expect, it } from 'vitest';
import { detectPlatform } from './install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15';

describe('detectPlatform', () => {
  it('separa iOS, Android e desktop', () => {
    expect(detectPlatform(IPHONE)).toBe('ios');
    expect(detectPlatform(ANDROID)).toBe('android');
    expect(detectPlatform(WINDOWS)).toBe('desktop');
    expect(detectPlatform(MAC, 0)).toBe('desktop');
  });

  it('iPad com iPadOS se apresenta como Mac, mas tem tela de toque', () => {
    expect(detectPlatform(MAC, 5)).toBe('ios');
  });
});
