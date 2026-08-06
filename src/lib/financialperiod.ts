import moment from 'moment-timezone';

import {
    DEFAULT_FINANCIAL_MONTH_START_DAY,
    FinancialPeriod,
    MAX_FINANCIAL_MONTH_START_DAY,
    MIN_FINANCIAL_MONTH_START_DAY
} from '@/core/financialperiod.ts';

export {
    DEFAULT_FINANCIAL_MONTH_START_DAY,
    MAX_FINANCIAL_MONTH_START_DAY,
    MIN_FINANCIAL_MONTH_START_DAY
};

export function isValidFinancialMonthStartDay(startDay: number): boolean {
    return Number.isInteger(startDay)
        && startDay >= MIN_FINANCIAL_MONTH_START_DAY
        && startDay <= MAX_FINANCIAL_MONTH_START_DAY;
}

// A start day of 31 cannot exist in February, so it falls back to that month's final day. Doing
// this per month is what keeps consecutive periods contiguous: February's period then starts on
// the 28th, and January's period ends on the 27th.
export function resolveFinancialMonthStartDay(year: number, month: number, startDay: number): number {
    const daysInMonth = moment.utc({ year: year, month: month - 1, day: 1 }).daysInMonth();
    return Math.min(startDay, daysInMonth);
}

function startOfPeriod(year: number, month: number, startDay: number, utcOffset?: number): moment.Moment {
    const resolvedDay = resolveFinancialMonthStartDay(year, month, startDay);
    const start = moment.utc({ year: year, month: month - 1, day: resolvedDay });

    if (typeof utcOffset === 'number') {
        // The period boundary is midnight in the user's zone, not midnight UTC.
        return start.subtract(utcOffset, 'minutes');
    }

    return start;
}

function buildPeriod(year: number, month: number, startDay: number, utcOffset?: number): FinancialPeriod {
    const start = startOfPeriod(year, month, startDay, utcOffset);
    const nextMonth = moment.utc({ year: year, month: month - 1, day: 1 }).add(1, 'month');
    const nextStart = startOfPeriod(nextMonth.year(), nextMonth.month() + 1, startDay, utcOffset);

    return FinancialPeriod.of(year, month, start.unix(), nextStart.unix() - 1);
}

export function getFinancialPeriodFromUnixTime(unixTime: number, startDay: number, utcOffset?: number): FinancialPeriod {
    const effectiveStartDay = isValidFinancialMonthStartDay(startDay) ? startDay : DEFAULT_FINANCIAL_MONTH_START_DAY;

    let date = moment.unix(unixTime).utc();

    if (typeof utcOffset === 'number') {
        date = date.add(utcOffset, 'minutes');
    }

    const year = date.year();
    const month = date.month() + 1;
    const resolvedDay = resolveFinancialMonthStartDay(year, month, effectiveStartDay);

    // Before this month's start day the time still belongs to the period that began last month.
    if (date.date() >= resolvedDay) {
        return buildPeriod(year, month, effectiveStartDay, utcOffset);
    }

    const previousMonth = moment.utc({ year: year, month: month - 1, day: 1 }).subtract(1, 'month');
    return buildPeriod(previousMonth.year(), previousMonth.month() + 1, effectiveStartDay, utcOffset);
}

export function getFinancialPeriodByOffset(period: FinancialPeriod, monthOffset: number, startDay: number, utcOffset?: number): FinancialPeriod {
    const effectiveStartDay = isValidFinancialMonthStartDay(startDay) ? startDay : DEFAULT_FINANCIAL_MONTH_START_DAY;
    const target = moment.utc({ year: period.year, month: period.month - 1, day: 1 }).add(monthOffset, 'month');

    return buildPeriod(target.year(), target.month() + 1, effectiveStartDay, utcOffset);
}
