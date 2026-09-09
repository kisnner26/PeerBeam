export const JOIN_WINDOW_MS = 60_000;
export const MAX_FAILED_JOINS = 5;

/** Per-connection budget. Distributed limits belong at a trusted reverse proxy. */
export class JoinLimiter {
  private start: number;
  private failures = 0;
  constructor(private readonly now = Date.now) {
    this.start = now();
  }
  get blocked() {
    if (this.now() - this.start >= JOIN_WINDOW_MS) {
      this.start = this.now();
      this.failures = 0;
    }
    return this.failures >= MAX_FAILED_JOINS;
  }
  fail() {
    if (!this.blocked) this.failures++;
  }
}
