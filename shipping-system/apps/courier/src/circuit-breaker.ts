// Guards OutboxPollerService's calls to IEventPublisher (NATS). Without
// this, a NATS outage means every poll tick (every 500ms) retries every
// PENDING row and logs an error for each - hammering an already-down
// dependency and flooding logs. After enough consecutive failures, the
// breaker opens and skips publish attempts entirely for a cooldown
// window (doubling on repeated failure, capped), then allows one trial
// attempt (half-open) to check if the dependency has recovered.
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  initialCooldownMs: number;
  maxCooldownMs: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private nextAttemptAt = 0;
  private cooldownMs: number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.cooldownMs = options.initialCooldownMs;
  }

  getState(): CircuitState {
    return this.state;
  }

  // Call before attempting an operation. Returns false if the breaker is
  // OPEN and the cooldown hasn't elapsed yet - the caller should skip the
  // attempt entirely. Transitions OPEN -> HALF_OPEN once the cooldown
  // elapses, allowing exactly one trial attempt through.
  canAttempt(now: number = Date.now()): boolean {
    if (this.state !== CircuitState.OPEN) {
      return true;
    }
    if (now >= this.nextAttemptAt) {
      this.state = CircuitState.HALF_OPEN;
      return true;
    }
    return false;
  }

  onSuccess(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.cooldownMs = this.options.initialCooldownMs;
  }

  onFailure(now: number = Date.now()): void {
    this.consecutiveFailures += 1;
    const shouldOpen =
      this.state === CircuitState.HALF_OPEN ||
      this.consecutiveFailures >= this.options.failureThreshold;
    if (shouldOpen) {
      this.state = CircuitState.OPEN;
      this.nextAttemptAt = now + this.cooldownMs;
      this.cooldownMs = Math.min(
        this.cooldownMs * 2,
        this.options.maxCooldownMs,
      );
    }
  }
}
