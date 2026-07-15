import { CircuitBreaker, CircuitState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  const options = {
    failureThreshold: 3,
    initialCooldownMs: 1000,
    maxCooldownMs: 8000,
  };

  it('starts CLOSED and allows attempts', () => {
    const breaker = new CircuitBreaker(options);

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.canAttempt(0)).toBe(true);
  });

  it('stays CLOSED while failures are below the threshold', () => {
    const breaker = new CircuitBreaker(options);

    breaker.onFailure(0);
    breaker.onFailure(0);

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.canAttempt(0)).toBe(true);
  });

  it('opens once consecutive failures reach the threshold, blocking attempts until cooldown elapses', () => {
    const breaker = new CircuitBreaker(options);

    breaker.onFailure(0);
    breaker.onFailure(0);
    breaker.onFailure(0);

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.canAttempt(500)).toBe(false);
    expect(breaker.canAttempt(999)).toBe(false);
  });

  it('transitions to HALF_OPEN and allows one trial attempt once the cooldown elapses', () => {
    const breaker = new CircuitBreaker(options);
    breaker.onFailure(0);
    breaker.onFailure(0);
    breaker.onFailure(0);

    const allowed = breaker.canAttempt(1000);

    expect(allowed).toBe(true);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('closes and resets the cooldown on a successful attempt', () => {
    const breaker = new CircuitBreaker(options);
    breaker.onFailure(0);
    breaker.onFailure(0);
    breaker.onFailure(0);
    breaker.canAttempt(1000);

    breaker.onSuccess();

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.canAttempt(1000)).toBe(true);
    // cooldown was reset to initial - reopening should wait the initial
    // duration again, not a doubled one.
    breaker.onFailure(1000);
    breaker.onFailure(1000);
    breaker.onFailure(1000);
    expect(breaker.canAttempt(1000 + options.initialCooldownMs - 1)).toBe(
      false,
    );
    expect(breaker.canAttempt(1000 + options.initialCooldownMs)).toBe(true);
  });

  it('re-opens with a doubled cooldown if the HALF_OPEN trial attempt also fails', () => {
    const breaker = new CircuitBreaker(options);
    breaker.onFailure(0);
    breaker.onFailure(0);
    breaker.onFailure(0);
    breaker.canAttempt(1000); // -> HALF_OPEN

    breaker.onFailure(1000);

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    // doubled cooldown (2000ms), not the initial 1000ms
    expect(breaker.canAttempt(1000 + options.initialCooldownMs)).toBe(false);
    expect(breaker.canAttempt(1000 + options.initialCooldownMs * 2)).toBe(true);
  });

  it('caps the cooldown at maxCooldownMs after repeated re-opens', () => {
    const breaker = new CircuitBreaker(options);
    let now = 0;
    breaker.onFailure(now);
    breaker.onFailure(now);
    breaker.onFailure(now); // OPEN, cooldown -> 2000ms next

    for (let i = 0; i < 5; i++) {
      now += options.maxCooldownMs * 2; // always past cooldown
      breaker.canAttempt(now); // -> HALF_OPEN
      breaker.onFailure(now); // fails again, doubles (capped)
    }

    // cooldown should never exceed maxCooldownMs
    const beforeCap = now + options.maxCooldownMs - 1;
    const atCap = now + options.maxCooldownMs;
    expect(breaker.canAttempt(beforeCap)).toBe(false);
    expect(breaker.canAttempt(atCap)).toBe(true);
  });
});
