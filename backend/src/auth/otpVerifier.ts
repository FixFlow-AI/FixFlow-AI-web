import crypto from 'crypto';

/**
 * Decodes a base32-encoded string into a Buffer.
 * Supports standard TOTP secrets (A-Z, 2-7).
 */
function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generates a one-time password (HOTP) for a given secret and counter.
 */
export function generateHotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  let tmp = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buffer[i] = Number(tmp & 0xffn);
    tmp >>= 8n;
  }

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = code % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a Time-based One-Time Password (TOTP) against a base32-encoded secret.
 * Allows a clock drift window (default 30 seconds).
 */
export function verifyOtp(token: string, secret: string, windowSeconds = 30): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d+$/.test(cleanToken)) {
    return false;
  }
  const counter = Math.floor(Date.now() / 30000);
  const windowSteps = Math.floor(windowSeconds / 30);
  for (let i = -windowSteps; i <= windowSteps; i++) {
    try {
      if (generateHotp(secret, counter + i) === cleanToken) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}
