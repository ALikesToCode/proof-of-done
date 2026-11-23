import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A 26-character id that sorts by creation time (the ULID layout: 10 characters of
 * time, 16 of randomness). Forge SQL advises against AUTO_INCREMENT keys, and a
 * sortable id keeps "latest verdict wins" correct even when two rows share a millisecond
 * only by chance of the random tail, which is why callers still order by created_at first.
 */
export function newId(now: number = Date.now()): string {
  let time = '';
  let t = Math.floor(now);
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(16);
  let random = '';
  for (let i = 0; i < 16; i++) {
    random += ALPHABET[(bytes[i] ?? 0) % 32];
  }
  return time + random;
}
