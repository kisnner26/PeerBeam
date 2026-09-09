import { expect, it } from 'vitest';
import { JoinLimiter, JOIN_WINDOW_MS, MAX_FAILED_JOINS } from './joinLimiter';
it('counts failed joins, allows the budget, and resets at the exact window boundary', () => {
  let now = 0;
  const limiter = new JoinLimiter(() => now);
  for (let i = 0; i < MAX_FAILED_JOINS; i++) {
    expect(limiter.blocked).toBe(false);
    limiter.fail();
  }
  expect(limiter.blocked).toBe(true);
  now = JOIN_WINDOW_MS - 1;
  expect(limiter.blocked).toBe(true);
  now++;
  expect(limiter.blocked).toBe(false);
  limiter.fail();
  expect(limiter.blocked).toBe(false);
});
