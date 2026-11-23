import { describe, expect, it } from 'vitest';
import { MeterCounts, readMeter, toWindowDays } from '../src/core/meter';

const counts = (overrides: Partial<MeterCounts> = {}): MeterCounts => ({
  windowDays: 7,
  opened: 0,
  reopened: 0,
  closed: 0,
  closedProven: 0,
  closedUnproven: 0,
  evidence: 0,
  verdicts: 0,
  ...overrides,
});

describe('the project meter', () => {
  it('climbs when proven closures outrun opened and reopened work', () => {
    const meter = readMeter(counts({ opened: 2, reopened: 1, closed: 5, closedProven: 4, closedUnproven: 1 }));
    expect(meter.verdict).toBe('climbing');
    expect(meter.reason).toBe('4 work items were closed with proof, against 3 opened or reopened.');
  });

  it('does not climb on a tie', () => {
    expect(readMeter(counts({ opened: 3, closed: 3, closedProven: 3 })).verdict).toBe('busy');
  });

  it('calls closing without proof busy, however many were closed', () => {
    const meter = readMeter(counts({ opened: 2, closed: 9, closedProven: 1, closedUnproven: 3 }));
    expect(meter.verdict).toBe('busy');
    expect(meter.closedNoContract).toBe(5);
    expect(meter.reason).toBe(
      '1 work item was closed with proof, against 2 opened or reopened. 8 more were closed without proof, and those do not count.',
    );
  });

  it('counts evidence and verdicts as activity', () => {
    const meter = readMeter(counts({ evidence: 3 }));
    expect(meter.verdict).toBe('busy');
    expect(meter.reason).toBe('0 work items were closed with proof, against 0 opened or reopened.');
  });

  it('says one closure without proof in the singular', () => {
    expect(readMeter(counts({ opened: 1, closed: 1 })).reason).toBe(
      '0 work items were closed with proof, against 1 opened or reopened. 1 more was closed without proof, and that does not count.',
    );
  });

  it('is stalled when nothing happened', () => {
    const meter = readMeter(counts({ windowDays: 14 }));
    expect(meter.verdict).toBe('stalled');
    expect(meter.reason).toBe('Nothing was opened, closed or proven in the last 14 days.');
  });

  it('keeps the split inside the total when the two sources disagree', () => {
    const meter = readMeter(counts({ closed: 1, closedProven: 2, closedUnproven: 1 }));
    expect(meter.closed).toBe(3);
    expect(meter.closedNoContract).toBe(0);
  });

  it('treats bad numbers as zero', () => {
    const meter = readMeter(counts({ opened: Number.NaN, closed: -4, closedProven: 2.9 }));
    expect(meter).toMatchObject({ opened: 0, closed: 2, closedProven: 2, verdict: 'climbing' });
  });
});

describe('toWindowDays', () => {
  it('accepts the offered windows and falls back to a week', () => {
    expect(toWindowDays(14)).toBe(14);
    expect(toWindowDays('30')).toBe(30);
    expect(toWindowDays(3)).toBe(7);
    expect(toWindowDays(undefined)).toBe(7);
  });
});
