import { describe, expect, it } from 'vitest';
import moment from 'moment-timezone';

import {
    DEFAULT_FINANCIAL_MONTH_START_DAY,
    MAX_FINANCIAL_MONTH_START_DAY,
    MIN_FINANCIAL_MONTH_START_DAY,
    getFinancialPeriodByOffset,
    getFinancialPeriodFromUnixTime,
    isValidFinancialMonthStartDay,
    resolveFinancialMonthStartDay
} from '@/lib/financialperiod.ts';

function unixTimeOf(isoDate: string): number {
    return moment.utc(isoDate, 'YYYY-MM-DD HH:mm:ss').unix();
}

function startOf(period: { minUnixTime: number }): string {
    return moment.unix(period.minUnixTime).utc().format('YYYY-MM-DD HH:mm:ss');
}

function endOf(period: { maxUnixTime: number }): string {
    return moment.unix(period.maxUnixTime).utc().format('YYYY-MM-DD HH:mm:ss');
}

describe('isValidFinancialMonthStartDay', () => {
    it('should accept every day from 1 to 31', () => {
        for (let day = MIN_FINANCIAL_MONTH_START_DAY; day <= MAX_FINANCIAL_MONTH_START_DAY; day++) {
            expect(isValidFinancialMonthStartDay(day)).toBe(true);
        }
    });

    it('should reject out-of-range, fractional and non-numeric values', () => {
        expect(isValidFinancialMonthStartDay(0)).toBe(false);
        expect(isValidFinancialMonthStartDay(32)).toBe(false);
        expect(isValidFinancialMonthStartDay(-1)).toBe(false);
        expect(isValidFinancialMonthStartDay(1.5)).toBe(false);
        expect(isValidFinancialMonthStartDay(Number.NaN)).toBe(false);
    });

    it('should default to the first day of the month', () => {
        expect(DEFAULT_FINANCIAL_MONTH_START_DAY).toBe(1);
    });
});

describe('resolveFinancialMonthStartDay', () => {
    it('should keep a start day that exists in the month', () => {
        expect(resolveFinancialMonthStartDay(2026, 1, 31)).toBe(31);
        expect(resolveFinancialMonthStartDay(2026, 8, 10)).toBe(10);
    });

    it('should clamp to the final day of a short month', () => {
        expect(resolveFinancialMonthStartDay(2026, 2, 31)).toBe(28); // 2026 is not a leap year
        expect(resolveFinancialMonthStartDay(2024, 2, 31)).toBe(29); // 2024 is a leap year
        expect(resolveFinancialMonthStartDay(2026, 4, 31)).toBe(30);
    });

    it('should treat February 29 correctly on both sides of a leap year', () => {
        expect(resolveFinancialMonthStartDay(2024, 2, 29)).toBe(29);
        expect(resolveFinancialMonthStartDay(2026, 2, 29)).toBe(28);
    });
});

describe('getFinancialPeriodFromUnixTime', () => {
    it('should match calendar months when the start day is 1', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-15 12:00:00'), 1);

        expect(period.year).toBe(2026);
        expect(period.month).toBe(8);
        expect(startOf(period)).toBe('2026-08-01 00:00:00');
        expect(endOf(period)).toBe('2026-08-31 23:59:59');
    });

    it('should run from the start day to the day before the next start day', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-15 12:00:00'), 10);

        expect(period.year).toBe(2026);
        expect(period.month).toBe(8);
        expect(startOf(period)).toBe('2026-08-10 00:00:00');
        expect(endOf(period)).toBe('2026-09-09 23:59:59');
    });

    it('should belong to the previous month before the start day is reached', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-09 23:00:00'), 10);

        expect(period.year).toBe(2026);
        expect(period.month).toBe(7);
        expect(startOf(period)).toBe('2026-07-10 00:00:00');
        expect(endOf(period)).toBe('2026-08-09 23:59:59');
    });

    it('should include the exact start instant in the new period', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-10 00:00:00'), 10);
        expect(period.month).toBe(8);
    });

    it('should roll the year backwards across January', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2026-01-05 12:00:00'), 10);

        expect(period.year).toBe(2025);
        expect(period.month).toBe(12);
        expect(startOf(period)).toBe('2025-12-10 00:00:00');
        expect(endOf(period)).toBe('2026-01-09 23:59:59');
    });

    // The worked example from the spec.
    it('should clamp a start day of 31 through a non-leap February', () => {
        const january = getFinancialPeriodFromUnixTime(unixTimeOf('2026-02-01 12:00:00'), 31);
        expect(startOf(january)).toBe('2026-01-31 00:00:00');
        expect(endOf(january)).toBe('2026-02-27 23:59:59');

        const february = getFinancialPeriodFromUnixTime(unixTimeOf('2026-03-01 12:00:00'), 31);
        expect(startOf(february)).toBe('2026-02-28 00:00:00');
        expect(endOf(february)).toBe('2026-03-30 23:59:59');

        const march = getFinancialPeriodFromUnixTime(unixTimeOf('2026-04-01 12:00:00'), 31);
        expect(startOf(march)).toBe('2026-03-31 00:00:00');
        expect(endOf(march)).toBe('2026-04-29 23:59:59');
    });

    it('should use February 29 as the start in a leap year', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2024-03-01 12:00:00'), 31);
        expect(startOf(period)).toBe('2024-02-29 00:00:00');
        expect(endOf(period)).toBe('2024-03-30 23:59:59');
    });

    it('should honour a utc offset when deciding which period a time falls in', () => {
        // 2026-08-09 18:00 UTC is 2026-08-10 01:00 in UTC+7, which is already the next period.
        const utc = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-09 18:00:00'), 10);
        expect(utc.month).toBe(7);

        const hoChiMinh = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-09 18:00:00'), 10, 420);
        expect(hoChiMinh.month).toBe(8);
    });
});

describe('getFinancialPeriodByOffset', () => {
    it('should step forwards and backwards a month at a time', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-15 12:00:00'), 10);

        const next = getFinancialPeriodByOffset(period, 1, 10);
        expect(next.year).toBe(2026);
        expect(next.month).toBe(9);
        expect(startOf(next)).toBe('2026-09-10 00:00:00');

        const previous = getFinancialPeriodByOffset(period, -1, 10);
        expect(previous.year).toBe(2026);
        expect(previous.month).toBe(7);
        expect(startOf(previous)).toBe('2026-07-10 00:00:00');
    });

    it('should cross a year boundary in both directions', () => {
        const december = getFinancialPeriodFromUnixTime(unixTimeOf('2026-12-15 12:00:00'), 5);

        expect(getFinancialPeriodByOffset(december, 1, 5).year).toBe(2027);
        expect(getFinancialPeriodByOffset(december, 1, 5).month).toBe(1);
        expect(getFinancialPeriodByOffset(december, -12, 5).year).toBe(2025);
        expect(getFinancialPeriodByOffset(december, -12, 5).month).toBe(12);
    });

    it('should return an identical period for a zero offset', () => {
        const period = getFinancialPeriodFromUnixTime(unixTimeOf('2026-08-15 12:00:00'), 10);
        const same = getFinancialPeriodByOffset(period, 0, 10);

        expect(same.minUnixTime).toBe(period.minUnixTime);
        expect(same.maxUnixTime).toBe(period.maxUnixTime);
    });
});

// The property that matters most: whatever the start day, consecutive periods must tile the
// timeline exactly — no day belongs to two periods, and no day belongs to none.
describe('period contiguity', () => {
    for (const startDay of [1, 15, 28, 29, 30, 31]) {
        it(`should produce contiguous periods across two years with start day ${startDay}`, () => {
            let period = getFinancialPeriodFromUnixTime(unixTimeOf('2024-01-15 12:00:00'), startDay);

            for (let i = 0; i < 24; i++) {
                const next = getFinancialPeriodByOffset(period, 1, startDay);

                expect(next.minUnixTime).toBe(period.maxUnixTime + 1);
                expect(period.maxUnixTime).toBeGreaterThan(period.minUnixTime);

                period = next;
            }
        });

        it(`should place every day of 2024 in exactly the period that reports it, start day ${startDay}`, () => {
            const day = moment.utc('2024-01-01', 'YYYY-MM-DD');

            for (let i = 0; i < 366; i++) {
                const unixTime = day.unix();
                const period = getFinancialPeriodFromUnixTime(unixTime, startDay);

                expect(unixTime).toBeGreaterThanOrEqual(period.minUnixTime);
                expect(unixTime).toBeLessThanOrEqual(period.maxUnixTime);

                day.add(1, 'day');
            }
        });
    }
});
