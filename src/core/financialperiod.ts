import type { UnixTimeRange } from './datetime.ts';

export const MIN_FINANCIAL_MONTH_START_DAY: number = 1;
export const MAX_FINANCIAL_MONTH_START_DAY: number = 31;
export const DEFAULT_FINANCIAL_MONTH_START_DAY: number = 1;

// A financial period is one "month" as the user defines it: it starts on their chosen day of the
// month rather than necessarily the 1st, and is named for the calendar month it starts in.
export class FinancialPeriod implements UnixTimeRange {
    public readonly year: number;
    public readonly month: number; // 1-based, the calendar month the period starts in
    public readonly minUnixTime: number;
    public readonly maxUnixTime: number;

    private constructor(year: number, month: number, minUnixTime: number, maxUnixTime: number) {
        this.year = year;
        this.month = month;
        this.minUnixTime = minUnixTime;
        this.maxUnixTime = maxUnixTime;
    }

    public static of(year: number, month: number, minUnixTime: number, maxUnixTime: number): FinancialPeriod {
        return new FinancialPeriod(year, month, minUnixTime, maxUnixTime);
    }
}
