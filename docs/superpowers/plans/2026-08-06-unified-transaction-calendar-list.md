# Unified Transaction Calendar List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate List, Calendar, and Gallery transaction modes with one mixed expense/income list navigated by a compact calendar and a configurable financial-month start day.

**Architecture:** Add tested financial-period helpers and one cloud-synced setting, then load each complete period through the existing filtered `transactions/list/all.json` endpoint. Replace the current date-picker wrapper with one shared plain-Vue period navigator; mobile and desktop keep their own list markup and native scroll observation because they use different UI frameworks.

**Tech Stack:** Vue 3, TypeScript, Pinia, Framework7 (mobile), Vuetify (desktop), Vitest, existing Moment-based datetime helpers.

## Global Constraints

- Apply the approved design in `docs/superpowers/specs/2026-08-06-unified-transaction-calendar-list-design.md` to both mobile and desktop.
- Financial month start accepts integers 1 through 31, defaults to 1, and clamps to the last day of short months.
- Periods are contiguous, named for their starting month, and loaded in full.
- Expense and income remain together; do not add spend/earn tabs.
- Remove Calendar and Gallery from visible transaction modes, but preserve old `pageType=1` and `pageType=2` URLs as unified-list inputs.
- Do not remove transaction pictures from details or editors.
- Never modify `src/views/mobile/transactions/EditPage.vue` or `src/views/desktop/transactions/list/dialogs/EditDialog.vue`.
- No backend changes and no new dependencies.
- Use 4-space indentation in `.ts` and `.vue` files.
- Respect strict TypeScript and `noUncheckedIndexedAccess`; narrow indexed values and do not silence them with non-null assertions.
- Run `npm run lint` and `npm run test` before every commit.
- At every task boundary, confirm `git diff --stat` does not list either protected transaction editor.

---

### Task 1: Financial-month setting and date math

**Files:**
- Create: `src/core/__tests__/setting.test.ts`
- Create: `src/lib/__tests__/datetime.test.ts`
- Modify: `src/core/setting.ts:31-235`
- Modify: `src/lib/datetime.ts:640-750`
- Modify: `src/stores/setting.ts:215-275,590-635`

**Interfaces:**
- Produces: `getValidFinancialMonthStartDay(value: number): number`.
- Produces: `getFinancialMonthDateRange(unixTime: number, startDay: number): TimeRange`.
- Produces: `shiftFinancialMonthDateRange(minTime: number, scale: number, startDay: number): TimeRange`.
- Produces: `getFinancialPeriodCalendarDays(minTime: number, maxTime: number, firstDayOfWeek: WeekDayValue): FinancialPeriodCalendarDay[]`.
- Produces: `settingsStore.setFinancialMonthStartDay(value: number): void` and `appSettings.financialMonthStartDay`.

- [ ] **Step 1: Write the setting contract test**

```ts
import { describe, expect, it } from 'vitest';

import {
    ALL_ALLOWED_CLOUD_SYNC_APP_SETTING_KEY_TYPES,
    DEFAULT_APPLICATION_SETTINGS,
    UserApplicationCloudSettingType,
    getValidFinancialMonthStartDay
} from '@/core/setting.ts';

describe('financialMonthStartDay', () => {
    it('is cloud-synced and defaults to the first day', () => {
        expect(DEFAULT_APPLICATION_SETTINGS.financialMonthStartDay).toBe(1);
        expect(ALL_ALLOWED_CLOUD_SYNC_APP_SETTING_KEY_TYPES.financialMonthStartDay).toBe(UserApplicationCloudSettingType.Number);
    });

    it('accepts only integer days from 1 through 31', () => {
        expect(getValidFinancialMonthStartDay(1)).toBe(1);
        expect(getValidFinancialMonthStartDay(31)).toBe(31);
        expect(getValidFinancialMonthStartDay(0)).toBe(1);
        expect(getValidFinancialMonthStartDay(32)).toBe(1);
        expect(getValidFinancialMonthStartDay(10.5)).toBe(1);
        expect(getValidFinancialMonthStartDay(Number.NaN)).toBe(1);
    });
});
```

- [ ] **Step 2: Write financial-period boundary tests**

```ts
import { describe, expect, it } from 'vitest';

import {
    getFinancialMonthDateRange,
    getFinancialPeriodCalendarDays,
    getYearMonthDayDateTime,
    parseDateTimeFromUnixTime,
    shiftFinancialMonthDateRange
} from '@/lib/datetime.ts';

function dates(minTime: number, maxTime: number): string[] {
    return [
        parseDateTimeFromUnixTime(minTime).getGregorianCalendarYearDashMonthDashDay(),
        parseDateTimeFromUnixTime(maxTime).getGregorianCalendarYearDashMonthDashDay()
    ];
}

describe('getFinancialMonthDateRange', () => {
    it('uses a normal calendar month for start day 1', () => {
        const range = getFinancialMonthDateRange(getYearMonthDayDateTime(2026, 8, 15).getUnixTime(), 1);
        expect(dates(range.minTime, range.maxTime)).toEqual(['2026-08-01', '2026-08-31']);
    });

    it('uses the selected day across Gregorian months', () => {
        const range = getFinancialMonthDateRange(getYearMonthDayDateTime(2026, 8, 20).getUnixTime(), 10);
        expect(dates(range.minTime, range.maxTime)).toEqual(['2026-08-10', '2026-09-09']);
    });

    it('clamps day 31 in non-leap and leap February', () => {
        const regular = getFinancialMonthDateRange(getYearMonthDayDateTime(2026, 2, 28).getUnixTime(), 31);
        const leap = getFinancialMonthDateRange(getYearMonthDayDateTime(2028, 2, 29).getUnixTime(), 31);
        expect(dates(regular.minTime, regular.maxTime)).toEqual(['2026-02-28', '2026-03-30']);
        expect(dates(leap.minTime, leap.maxTime)).toEqual(['2028-02-29', '2028-03-30']);
    });

    it('shifts by financial periods without skipping a short month', () => {
        const february = getFinancialMonthDateRange(getYearMonthDayDateTime(2026, 2, 28).getUnixTime(), 31);
        expect(dates(shiftFinancialMonthDateRange(february.minTime, -1, 31).minTime,
            shiftFinancialMonthDateRange(february.minTime, -1, 31).maxTime)).toEqual(['2026-01-31', '2026-02-27']);
        expect(dates(shiftFinancialMonthDateRange(february.minTime, 1, 31).minTime,
            shiftFinancialMonthDateRange(february.minTime, 1, 31).maxTime)).toEqual(['2026-03-31', '2026-04-29']);
    });

    it('pads the period calendar to complete weeks', () => {
        const range = getFinancialMonthDateRange(getYearMonthDayDateTime(2026, 8, 20).getUnixTime(), 10);
        const days = getFinancialPeriodCalendarDays(range.minTime, range.maxTime, 1);
        expect(days.length % 7).toBe(0);
        expect(days.find(day => day.date === '2026-08-10')?.inPeriod).toBe(true);
        expect(days.find(day => day.date === '2026-09-09')?.inPeriod).toBe(true);
    });
});
```

- [ ] **Step 3: Run the focused tests to verify failure**

Run: `npx vitest run src/core/__tests__/setting.test.ts src/lib/__tests__/datetime.test.ts`

Expected: FAIL because the setting and helper exports do not exist.

- [ ] **Step 4: Add the setting, validator, and store setter**

In `src/core/setting.ts`, add the field under Transaction List Page, add it to the numeric cloud allowlist, and default it to 1:

```ts
export function getValidFinancialMonthStartDay(value: number): number {
    return Number.isInteger(value) && value >= 1 && value <= 31 ? value : 1;
}

// ApplicationSettings
financialMonthStartDay: number;

// ALL_ALLOWED_CLOUD_SYNC_APP_SETTING_KEY_TYPES
'financialMonthStartDay': UserApplicationCloudSettingType.Number,

// DEFAULT_APPLICATION_SETTINGS
financialMonthStartDay: 1,
```

In `src/stores/setting.ts`, follow the three-write pattern used by the neighboring transaction-list setters:

```ts
function setFinancialMonthStartDay(value: number): void {
    value = getValidFinancialMonthStartDay(value);
    updateApplicationSettingsValue('financialMonthStartDay', value);
    appSettings.value.financialMonthStartDay = value;
    updateUserApplicationCloudSettingValue('financialMonthStartDay', value);
}
```

Export `setFinancialMonthStartDay` from the store return object.

- [ ] **Step 5: Implement clamped period helpers**

Add the exported interface and helpers to `src/lib/datetime.ts`. Resolve every monthly anchor from the first of the target month plus `min(startDay, daysInMonth)`; do not set day 31 directly on Moment because that overflows short months.

```ts
export interface FinancialPeriodCalendarDay {
    readonly date: TextualYearMonthDay;
    readonly day: number;
    readonly inPeriod: boolean;
}

function getFinancialMonthStart(year: number, month1base: number, startDay: number): moment.Moment {
    const month = moment({ year: year, month: month1base - 1, date: 1 }).startOf('day');
    return month.date(Math.min(getValidFinancialMonthStartDay(startDay), month.daysInMonth()));
}

export function getFinancialMonthDateRange(unixTime: number, startDay: number): TimeRange {
    const anchor = moment.unix(unixTime).startOf('day');
    let start = getFinancialMonthStart(anchor.year(), anchor.month() + 1, startDay);

    if (anchor.isBefore(start)) {
        const previousMonth = anchor.clone().subtract(1, 'month');
        start = getFinancialMonthStart(previousMonth.year(), previousMonth.month() + 1, startDay);
    }

    const nextMonth = start.clone().add(1, 'month');
    const nextStart = getFinancialMonthStart(nextMonth.year(), nextMonth.month() + 1, startDay);
    return { minTime: start.unix(), maxTime: nextStart.subtract(1, 'second').unix() };
}
```

Implement `shiftFinancialMonthDateRange` from the starting month plus `scale`, and implement `getFinancialPeriodCalendarDays` by padding from the configured first weekday through the final weekday. Use `DateTime.add(1, 'days')` or Moment day addition, not 86,400-second arithmetic.

- [ ] **Step 6: Run all verification and commit**

Run:

```bash
npx vitest run src/core/__tests__/setting.test.ts src/lib/__tests__/datetime.test.ts
npm run lint
npm run test
git diff --stat
git add src/core/setting.ts src/core/__tests__/setting.test.ts src/lib/datetime.ts src/lib/__tests__/datetime.test.ts src/stores/setting.ts
git commit -m "feat: add financial month periods"
```

Expected: focused tests pass; lint passes; full test suite passes; protected editors are absent from the diff.

---

### Task 2: Financial-month controls in settings

**Files:**
- Modify: `src/views/base/settings/AppSettingsPageBase.ts:20-250`
- Modify: `src/views/desktop/app/settings/tabs/AppBasicSettingTab.vue:174-225,520-620`
- Modify: `src/views/mobile/settings/PageSettingsPage.vue:89-135,380-470`
- Modify: `src/locales/en.json`
- Modify: `src/locales/vi.json`

**Interfaces:**
- Consumes: `getValidFinancialMonthStartDay` and `settingsStore.setFinancialMonthStartDay` from Task 1.
- Produces: `allFinancialMonthStartDays: TypeAndDisplayName[]` and writable `financialMonthStartDay` from `useAppSettingPageBase()`.

- [ ] **Step 1: Add localized day options to the shared settings base**

Destructure `formatNumberToLocalizedNumerals` from `useI18n()`, then add:

```ts
const allFinancialMonthStartDays = computed<TypeAndDisplayName[]>(() => {
    return Array.from({ length: 31 }, (_, index) => ({
        type: index + 1,
        displayName: formatNumberToLocalizedNumerals(index + 1)
    }));
});

const financialMonthStartDay = computed<number>({
    get: () => getValidFinancialMonthStartDay(settingsStore.appSettings.financialMonthStartDay),
    set: (value: number) => settingsStore.setFinancialMonthStartDay(value)
});
```

Return both values from `useAppSettingPageBase()`.

- [ ] **Step 2: Add the desktop setting and remove obsolete pagination UI**

In the Transaction List Page card, remove the **Transactions Per Page** selector because a complete financial period is now always loaded. Add this selector in its place:

```vue
<v-select
    item-title="displayName"
    item-value="type"
    persistent-placeholder
    persistent-hint
    :label="tt('Financial Month Starts On')"
    :placeholder="tt('Financial Month Starts On')"
    :hint="tt('Short months use their final day')"
    :items="allFinancialMonthStartDays"
    v-model="financialMonthStartDay"
/>
```

Destructure the two shared values from `useAppSettingPageBase()`; do not add a second local computed.

- [ ] **Step 3: Add the mobile setting**

Add `showFinancialMonthStartDayPopup`, then put this item first in the Transaction List Page settings list:

```vue
<f7-list-item class="item-truncate-after-text" link="#" @click="showFinancialMonthStartDayPopup = true">
    <template #after-title>
        <div class="item-actual-title"><span>{{ tt('Financial Month Starts On') }}</span></div>
    </template>
    <template #after>{{ findDisplayNameByType(allFinancialMonthStartDays, financialMonthStartDay) }}</template>
    <list-item-selection-popup value-type="item"
                               key-field="type" value-field="type"
                               title-field="displayName"
                               :title="tt('Financial Month Starts On')"
                               :enable-filter="false"
                               :items="allFinancialMonthStartDays"
                               v-model:show="showFinancialMonthStartDayPopup"
                               v-model="financialMonthStartDay" />
</f7-list-item>
```

Add `<f7-block-footer>{{ tt('Short months use their final day') }}</f7-block-footer>` immediately after the Transaction List Page list.

- [ ] **Step 4: Add English and Vietnamese copy**

Add these top-level locale entries in the same alphabetical area in both files:

```json
// en.json
"Financial Month Starts On": "Financial Month Starts On",
"Short months use their final day": "Short months use their final day",
"No transactions on this day": "No transactions on this day",

// vi.json
"Financial Month Starts On": "Ngày bắt đầu tháng tài chính",
"Short months use their final day": "Tháng ngắn sẽ dùng ngày cuối tháng",
"No transactions on this day": "Không có giao dịch trong ngày này",
```

Do not add copy for Gallery or new spend/earn tabs.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run lint
npm run test
git diff --stat
git add src/views/base/settings/AppSettingsPageBase.ts src/views/desktop/app/settings/tabs/AppBasicSettingTab.vue src/views/mobile/settings/PageSettingsPage.vue src/locales/en.json src/locales/vi.json
git commit -m "feat: add financial month setting controls"
```

Expected: lint and all tests pass; only setting and locale files are staged; protected editors are absent.

---

### Task 3: Complete filtered-period loading

**Files:**
- Modify: `src/models/transaction.ts:610-647`
- Modify: `src/lib/services.ts:525-542`
- Modify: `src/stores/transaction.ts:840-1035,1710-1730`

**Interfaces:**
- Produces: expanded optional filters on `TransactionAllListRequest` without breaking `stores/explorer.ts`.
- Produces: `transactionsStore.loadAllTransactionsInRange({ autoExpand, defaultCurrency }): Promise<TransactionPageWrapper>`.
- Uses: existing backend `GET v1/transactions/list/all.json`; no Go change.

- [ ] **Step 1: Expand the frontend all-list request type**

Keep the explorer's current time-only call valid by making added fields optional:

```ts
export interface TransactionAllListRequest {
    readonly startTime: number;
    readonly endTime: number;
    readonly type?: number;
    readonly categoryIds?: string;
    readonly accountIds?: string;
    readonly tagFilter?: string;
    readonly amountFilter?: string;
    readonly keyword?: string;
    readonly matchMode?: number;
    readonly mustHavePictures?: boolean;
    readonly withPictures?: boolean;
}
```

- [ ] **Step 2: Forward every supported filter in the existing service**

Mirror the encoding used by `getTransactions`:

```ts
getAllTransactions: (req: TransactionAllListRequest): ApiResponsePromise<TransactionInfoResponse[]> => {
    const tagFilter = encodeURIComponent(req.tagFilter || '');
    const amountFilter = encodeURIComponent(req.amountFilter || '');
    const keyword = encodeURIComponent(req.keyword || '');
    return axios.get<ApiResponse<TransactionInfoResponse[]>>(`v1/transactions/list/all.json?start_time=${req.startTime}&end_time=${req.endTime}&type=${req.type || 0}&category_ids=${req.categoryIds || ''}&account_ids=${req.accountIds || ''}&tag_filter=${tagFilter}&amount_filter=${amountFilter}&keyword=${keyword}&match_mode=${req.matchMode || 0}&must_have_pictures=${!!req.mustHavePictures}&with_pictures=${!!req.withPictures}&trim_account=true&trim_category=true&trim_tag=true`);
},
```

- [ ] **Step 3: Add one store loading method**

Use the active filter and its exact range:

```ts
function loadAllTransactionsInRange({ autoExpand, defaultCurrency }: { autoExpand: boolean, defaultCurrency: string }): Promise<TransactionPageWrapper> {
    return new Promise((resolve, reject) => {
        services.getAllTransactions({
            startTime: transactionsFilter.value.minTime,
            endTime: transactionsFilter.value.maxTime,
            type: transactionsFilter.value.type,
            categoryIds: transactionsFilter.value.categoryIds,
            accountIds: transactionsFilter.value.accountIds,
            tagFilter: transactionsFilter.value.tagFilter,
            amountFilter: transactionsFilter.value.amountFilter,
            keyword: transactionsFilter.value.keyword,
            matchMode: transactionsFilter.value.matchMode
        }).then(response => {
            const data = response.data;

            if (!data || !data.success || !data.result) {
                loadTransactionList({ transactionPageWrapper: EMPTY_TRANSACTION_RESULT, reload: true, autoExpand: autoExpand, defaultCurrency: defaultCurrency });
                updateTransactionListInvalidState(true);
                reject({ message: 'Unable to retrieve transaction list' });
                return;
            }

            const result: TransactionPageWrapper = {
                items: Transaction.ofMulti(data.result),
                totalCount: data.result.length
            };
            loadTransactionList({ transactionPageWrapper: result, reload: true, autoExpand: autoExpand, defaultCurrency: defaultCurrency });
            updateTransactionListInvalidState(false);
            resolve(result);
        }).catch(error => {
            logger.error('failed to load all transactions in range', error);
            loadTransactionList({
                transactionPageWrapper: EMPTY_TRANSACTION_RESULT,
                reload: true,
                autoExpand: autoExpand,
                defaultCurrency: defaultCurrency
            });
            updateTransactionListInvalidState(true);

            if (error.response && error.response.data && error.response.data.errorMessage) {
                reject({ error: error.response.data });
            } else if (!error.processed) {
                reject({ message: 'Unable to retrieve transaction list' });
            } else {
                reject(error);
            }
        });
    });
}
```

Export the method from the store.

- [ ] **Step 4: Verify unchanged explorer behavior and commit**

Run:

```bash
npm run lint
npm run test
git diff --stat
git add src/models/transaction.ts src/lib/services.ts src/stores/transaction.ts
git commit -m "feat: load complete transaction periods"
```

Expected: the explorer compiles without call-site changes; lint and tests pass; protected editors are absent.

---

### Task 4: Shared period navigator and empty-date projection

**Files:**
- Create: `src/lib/__tests__/transaction.test.ts`
- Create: `src/components/common/TransactionPeriodNavigator.vue`
- Modify: `src/lib/transaction.ts`
- Modify: `src/views/base/transactions/TransactionListPageBase.ts:1-285,450-515`

**Interfaces:**
- Consumes: Task 1 period/calendar helpers and the existing `Transaction` display date.
- Produces: `TransactionDateMarker`, `TransactionListItem`, `isTransactionDateMarker`, and `getTransactionListItems`.
- Produces from the page base: `allTransactionsInPeriod`, `transactionListItems`, `transactionDates`, `financialPeriodTotalAmount`, `financialMonthStartDay`, `financialPeriodTitle`, `financialPeriodRangeText`, `financialPeriodIncomeText`, and `financialPeriodExpenseText`.
- Produces component events: `update:modelValue(date: TextualYearMonthDay)` and `shift(scale: -1 | 1)`.

- [ ] **Step 1: Write marker projection tests**

```ts
import { describe, expect, it } from 'vitest';

import { WeekDay, type TextualYearMonthDay } from '@/core/datetime.ts';
import { TransactionType } from '@/core/transaction.ts';
import { Transaction } from '@/models/transaction.ts';
import { getTransactionListItems, isTransactionDateMarker } from '@/lib/transaction.ts';

function transaction(id: string, date: TextualYearMonthDay): Transaction {
    const value = Transaction.createNewTransaction(TransactionType.Expense, 1, 'Asia/Ho_Chi_Minh', 420);
    value.id = id;
    value.setDisplayDate(date, parseInt(date.slice(-2)), WeekDay.Monday);
    return value;
}

describe('getTransactionListItems', () => {
    const transactions = [transaction('new', '2026-08-12'), transaction('old', '2026-08-10')];

    it('does not add a marker when the selected date has transactions', () => {
        expect(getTransactionListItems(transactions, '2026-08-12')).toEqual(transactions);
    });

    it('keeps a completely empty period in the normal empty state', () => {
        expect(getTransactionListItems([], '2026-08-12')).toEqual([]);
    });

    it('inserts an empty date in newest-first order', () => {
        const items = getTransactionListItems(transactions, '2026-08-11');
        expect(items.map(item => isTransactionDateMarker(item) ? item.date : item.id)).toEqual(['new', '2026-08-11', 'old']);
    });

    it('inserts markers at either period edge', () => {
        const first = getTransactionListItems(transactions, '2026-08-13')[0];
        const last = getTransactionListItems(transactions, '2026-08-09')[2];
        expect(first ? isTransactionDateMarker(first) : false).toBe(true);
        expect(last ? isTransactionDateMarker(last) : false).toBe(true);
    });
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `npx vitest run src/lib/__tests__/transaction.test.ts`

Expected: FAIL because the marker exports do not exist.

- [ ] **Step 3: Implement the smallest projection helper**

```ts
export interface TransactionDateMarker {
    readonly date: TextualYearMonthDay;
}

export type TransactionListItem = Transaction | TransactionDateMarker;

export function isTransactionDateMarker(item: TransactionListItem): item is TransactionDateMarker {
    return 'date' in item;
}

export function getTransactionListItems(transactions: readonly Transaction[], selectedDate: TextualYearMonthDay | ''): TransactionListItem[] {
    if (!transactions.length || !selectedDate || transactions.some(transaction => transaction.gregorianCalendarYearDashMonthDashDay === selectedDate)) {
        return [...transactions];
    }

    const items: TransactionListItem[] = [];
    let inserted = false;

    for (const transaction of transactions) {
        const date = transaction.gregorianCalendarYearDashMonthDashDay;
        if (!inserted && date && date < selectedDate) {
            items.push({ date: selectedDate });
            inserted = true;
        }
        items.push(transaction);
    }

    if (!inserted) {
        items.push({ date: selectedDate });
    }

    return items;
}
```

- [ ] **Step 4: Replace the old date-picker wrapper with the shared navigator**

Create `TransactionPeriodNavigator.vue` as a plain Vue/CSS component so Framework7 and Vuetify can both render it. Its public contract is:

```ts
const props = defineProps<{
    modelValue: TextualYearMonthDay | '';
    minTime: number;
    maxTime: number;
    title: string;
    rangeText: string;
    incomeText: string;
    expenseText: string;
    transactionDates: Record<string, boolean>;
    readonly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: TextualYearMonthDay): void;
    (e: 'shift', value: -1 | 1): void;
}>();
```

Use `getFinancialPeriodCalendarDays` for the expanded grid. Derive the seven compact-strip cells by finding the selected cell's index and slicing its seven-cell row. Render native `<button type="button">` elements with `aria-label`, `aria-pressed`, disabled state outside the period, and a dot when `transactionDates[day.date]` is true. Keep expansion internal with one `ref<boolean>(false)`; do not add a store setting.

Keep `TransactionCalendar.vue` for now because the desktop page still imports it until Task 6. Task 6 deletes the component and its two global registrations after both pages have migrated.

- [ ] **Step 5: Add shared list projections to the base**

Flatten the store's month buckets without changing store structure:

```ts
const financialMonthStartDay = computed<number>(() => getValidFinancialMonthStartDay(settingsStore.appSettings.financialMonthStartDay));
const allTransactionsInPeriod = computed<Transaction[]>(() => transactionsStore.transactions.flatMap(month => month.items));
const transactionDates = computed<Record<string, boolean>>(() => {
    const dates: Record<string, boolean> = {};
    for (const transaction of allTransactionsInPeriod.value) {
        if (transaction.gregorianCalendarYearDashMonthDashDay) {
            dates[transaction.gregorianCalendarYearDashMonthDashDay] = true;
        }
    }
    return dates;
});
const transactionListItems = computed<TransactionListItem[]>(() => getTransactionListItems(allTransactionsInPeriod.value, currentCalendarDate.value));
```

Sum the complete `TransactionMonthList.totalAmount` values into one `TransactionTotalAmount` using `BIG_DECIMAL_ZERO` and `BigDecimal.add`. Format the title from `query.minTime`'s Gregorian month and the range from `query.minTime/query.maxTime` using existing i18n formatters. Return these exact computed names from the base: `financialPeriodTitle`, `financialPeriodRangeText`, `financialPeriodIncomeText`, and `financialPeriodExpenseText`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npx vitest run src/lib/__tests__/transaction.test.ts src/lib/__tests__/datetime.test.ts
npm run lint
npm run test
git diff --stat
git add src/components/common/TransactionPeriodNavigator.vue src/lib/transaction.ts src/lib/__tests__/transaction.test.ts src/views/base/transactions/TransactionListPageBase.ts
git commit -m "feat: add transaction period navigator"
```

Expected: focused and full tests pass, `TransactionCalendar.vue` remains untouched for the still-unmigrated pages, and no editor file appears.

---

### Task 5: Unified mobile transaction list

**Files:**
- Modify: `src/mobile-main.ts:55,153`
- Modify: `src/stores/transaction.ts:793-830`
- Modify: `src/views/mobile/transactions/ListPage.vue:1-370,680-1280,1580-1770`

**Interfaces:**
- Consumes: `TransactionPeriodNavigator`, Task 4 base projections, Task 1 range shifting, and Task 3 full-range loader.
- Preserves: all current account/category/tag/type/amount/keyword filters and quick-add/detail/edit actions.
- Produces: mobile unified calendar/list interaction and compatibility for old page mode query values.

- [ ] **Step 1: Replace mode and date-range chrome**

Remove the page-type title popover and all visible List/Calendar/Gallery choices. Use the fixed title `tt('Transaction List')`. Remove Calendar-only blocks, Gallery markup, custom-month sheet, and date-range picker controls. Keep the filter controls for category, account, type, amount, tags, and keyword.

Remove the obsolete `TransactionCalendar` import and global registration from `src/mobile-main.ts`; import `TransactionPeriodNavigator` locally in the mobile list page.

Mount the navigator above the list:

```vue
<transaction-period-navigator
    :readonly="loading"
    :min-time="query.minTime"
    :max-time="query.maxTime"
    :title="financialPeriodTitle"
    :range-text="financialPeriodRangeText"
    :income-text="financialPeriodIncomeText"
    :expense-text="financialPeriodExpenseText"
    :transaction-dates="transactionDates"
    :model-value="currentCalendarDate"
    @update:model-value="selectCalendarDate"
    @shift="shiftFinancialPeriod"
/>
```

- [ ] **Step 2: Render one flat mixed list with an empty-date row**

Remove month accordions, Gallery cells, infinite loading, and month virtualization. Iterate `transactionListItems` once. For markers render:

```vue
<f7-list-item v-if="isTransactionDateMarker(item)"
              class="transaction-empty-date-marker"
              :id="getTransactionDateDomId(item.date)"
              :data-transaction-date="item.date"
              :title="tt('No transactions on this day')" />
```

For transactions, put the same id/data attributes only on the first transaction of each date. Keep the existing transaction item body, swipe actions, quick-save behavior, and mixed expense/income amount classes unchanged.

- [ ] **Step 3: Normalize initialization and period loading**

Ignore old `pageType` values instead of rejecting them. Determine the anchor in this order: valid `selectedDate` query, valid incoming date range `minTime`, then current time. Convert it to `getFinancialMonthDateRange(anchor, financialMonthStartDay.value)`, set the store filter to `DateRange.Custom`, and select today when it lies inside the current period or the period start otherwise.

Replace both monthly-all and paginated branches in `reload()` with:

```ts
return transactionsStore.loadAllTransactionsInRange({
    autoExpand: true,
    defaultCurrency: selectedAccountDefaultCurrency.value
});
```

Remove `loadMore`, `loadingMore`, `hasMoreTransaction`, and the page's infinite-scroll props.

Extend the existing URL builder without changing its current desktop behavior yet:

```ts
function getTransactionListPageParams(pageType: number, selectedDate?: TextualYearMonthDay): string {
    const querys: string[] = [];
    querys.push('pageType=' + pageType);

    if (transactionsFilter.value.type) {
        querys.push('type=' + transactionsFilter.value.type);
    }
    if (transactionsFilter.value.accountIds) {
        querys.push('accountIds=' + transactionsFilter.value.accountIds);
    }
    if (transactionsFilter.value.categoryIds) {
        querys.push('categoryIds=' + transactionsFilter.value.categoryIds);
    }
    if (transactionsFilter.value.tagFilter) {
        querys.push('tagFilter=' + transactionsFilter.value.tagFilter);
    }

    querys.push('dateType=' + transactionsFilter.value.dateType);
    if (DateRange.isBillingCycle(transactionsFilter.value.dateType)
        || DateRange.isLastReconciledTimeRange(transactionsFilter.value.dateType)
        || transactionsFilter.value.dateType === DateRange.Custom.type) {
        querys.push('maxTime=' + transactionsFilter.value.maxTime);
        querys.push('minTime=' + transactionsFilter.value.minTime);
    }

    if (transactionsFilter.value.amountFilter) {
        querys.push('amountFilter=' + encodeURIComponent(transactionsFilter.value.amountFilter));
    }
    if (transactionsFilter.value.keyword) {
        querys.push('keyword=' + encodeURIComponent(transactionsFilter.value.keyword));
        querys.push('matchMode=' + transactionsFilter.value.matchMode);
    }
    if (selectedDate) {
        querys.push('selectedDate=' + selectedDate);
    }
    return querys.join('&');
}
```

- [ ] **Step 4: Add two-way date/scroll behavior**

Implement calendar selection with native scrolling:

```ts
function getTransactionDateDomId(date: TextualYearMonthDay): string {
    return `transaction_date_${date}`;
}

async function selectCalendarDate(date: TextualYearMonthDay): Promise<void> {
    currentCalendarDate.value = date;
    replaceTransactionListUrl();
    await nextTick();
    document.getElementById(getTransactionDateDomId(date))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

On mount and after each reload, observe `[data-transaction-date]` with native `IntersectionObserver`. Narrow the dataset value before assigning it and never call `selectCalendarDate` from the observer:

```ts
let dateObserver: IntersectionObserver | undefined;

function isTextualYearMonthDay(value: string | undefined): value is TextualYearMonthDay {
    return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function observeTransactionDates(): Promise<void> {
    await nextTick();
    dateObserver?.disconnect();
    dateObserver = new IntersectionObserver(entries => {
        const firstVisible = entries
            .filter(entry => entry.isIntersecting)
            .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];

        if (!(firstVisible?.target instanceof HTMLElement)) {
            return;
        }

        const date = firstVisible.target.dataset.transactionDate;
        if (isTextualYearMonthDay(date)) {
            currentCalendarDate.value = date;
        }
    }, { rootMargin: '-120px 0px -70% 0px' });

    document.querySelectorAll<HTMLElement>('[data-transaction-date]').forEach(element => dateObserver?.observe(element));
}
```

Call `dateObserver?.disconnect()` in `onBeforeUnmount`. Recreate it after list replacement.

`shiftFinancialPeriod(scale)` must call `shiftFinancialMonthDateRange`, select the new period's start date, update the Custom filter range, reload, and replace the mobile URL query without adding a history entry. Keep old `pageType=1/2` input accepted but emit only the unified `pageType=0` URL.

Use the existing store query builder with `getTransactionListPageParams(0, currentCalendarDate.value)`. For explicit calendar selection and period changes, replace only the current browser URL:

```ts
function replaceTransactionListUrl(): void {
    const url = new URL(window.location.href);
    url.search = transactionsStore.getTransactionListPageParams(0, currentCalendarDate.value);
    window.history.replaceState(window.history.state, '', url);
}
```

Watch `financialMonthStartDay`. When it changes, calculate the new period containing `currentCalendarDate`, update the Custom filter range, and reload once.

- [ ] **Step 5: Run mobile manual checks**

Start the backend and frontend, then verify at `/mobile.html`:

1. Only the unified list is visible; no Calendar/Gallery selector remains.
2. Expense and income appear in the same list.
3. Week-strip selection scrolls to a populated day without filtering surrounding dates.
4. Selecting an empty day inserts and reaches the localized marker.
5. Manual scrolling updates the selected day/week without focus jumps.
6. Expanding the calendar shows the complete financial period and disables padding dates.
7. Previous/next loads the exact adjacent period for start days 10 and 31.
8. Old links with `pageType=1` and `pageType=2` open the unified list.
9. Pull-to-refresh, filters, transaction detail, quick-add, edit, and pictures still work.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run lint
npm run test
git diff --stat
git add src/mobile-main.ts src/stores/transaction.ts src/views/mobile/transactions/ListPage.vue
git commit -m "feat: unify mobile transaction calendar list"
```

Expected: manual checks observed, lint/tests pass, and neither protected editor is listed.

---

### Task 6: Unified desktop transaction list

**Files:**
- Modify: `src/desktop-main.ts:95,554`
- Modify: `src/router/desktop.ts:105-120`
- Modify: `src/stores/transaction.ts:790-830`
- Modify: `src/views/desktop/transactions/ListPage.vue:1-670,810-1510,1950-2040`
- Delete: `src/components/common/TransactionCalendar.vue`

**Interfaces:**
- Consumes: the same navigator, projections, range helpers, and full loader used by mobile.
- Preserves: quick-add row, batch actions, filters, transaction detail/edit dialogs, and transaction pictures.
- Produces: `selectedDate` desktop route prop and unified outgoing list URLs.

- [ ] **Step 1: Accept selected date and normalize old page modes**

Add `initSelectedDate: route.query['selectedDate']` in `src/router/desktop.ts` and the matching optional prop. Continue accepting `initPageType`, but never render a separate mode; `pageType=1` and `pageType=2` are compatibility inputs only.

Change `getTransactionListPageParams` to keep its numeric compatibility argument while always emitting the unified mode and exact Custom period. Make these concrete changes to the full function written in Task 5; all filter and `selectedDate` clauses remain present:

```ts
function getTransactionListPageParams(_pageType: number, selectedDate?: TextualYearMonthDay): string {
    const querys: string[] = ['pageType=0'];

    if (transactionsFilter.value.type) {
        querys.push('type=' + transactionsFilter.value.type);
    }
    if (transactionsFilter.value.accountIds) {
        querys.push('accountIds=' + transactionsFilter.value.accountIds);
    }
    if (transactionsFilter.value.categoryIds) {
        querys.push('categoryIds=' + transactionsFilter.value.categoryIds);
    }
    if (transactionsFilter.value.tagFilter) {
        querys.push('tagFilter=' + transactionsFilter.value.tagFilter);
    }

    querys.push('dateType=' + DateRange.Custom.type);
    querys.push('maxTime=' + transactionsFilter.value.maxTime);
    querys.push('minTime=' + transactionsFilter.value.minTime);

    if (transactionsFilter.value.amountFilter) {
        querys.push('amountFilter=' + encodeURIComponent(transactionsFilter.value.amountFilter));
    }
    if (transactionsFilter.value.keyword) {
        querys.push('keyword=' + encodeURIComponent(transactionsFilter.value.keyword));
        querys.push('matchMode=' + transactionsFilter.value.matchMode);
    }
    if (selectedDate) {
        querys.push('selectedDate=' + selectedDate);
    }
    return querys.join('&');
}
```

Update the desktop call site to pass `0` and the selected date. The mobile call added in Task 5 already uses this signature.

- [ ] **Step 2: Replace desktop mode/calendar/gallery UI**

Remove the page-type selector, standalone Calendar card, Gallery card, recent date-range control, Custom Month dialog, and pagination. Mount `TransactionPeriodNavigator` above the table with the same props/events as mobile. Keep the inline `QuickAddRow` and its reload event exactly where it remains visible.

Render `transactionListItems` in newest-first order. A marker is a full-width table row:

```vue
<tr v-if="isTransactionDateMarker(item)"
    class="transaction-empty-date-marker"
    :id="getTransactionDateDomId(item.date)"
    :data-transaction-date="item.date">
    <td :colspan="visibleColumnCount">{{ tt('No transactions on this day') }}</td>
</tr>
```

Do not add selection checkboxes or row actions to the marker. Preserve current transaction columns, batch selection, amount colors/signs, edit/details behavior, and picture access.

- [ ] **Step 3: Use complete-period loading and two-way scrolling**

Normalize the initial anchor and Custom period exactly as mobile, then replace desktop monthly/paginated loading with `loadAllTransactionsInRange`. Delete `currentPage`, `countPerPage`, `currentPageTransactions`, `totalCount`, and page-count computed values that are now dead.

Use the same `getTransactionDateDomId`, `selectCalendarDate`, and IntersectionObserver behavior as Task 5. For URL persistence, call:

```ts
router.replace(`/transaction/list?${transactionsStore.getTransactionListPageParams(0, currentCalendarDate.value)}`);
```

Call `router.replace` for explicit date selection and period shifts. During scroll observation, debounce replacement to one update after scrolling settles; never push a history entry per visible date.

Changing `financialMonthStartDay` while this page is mounted must recalculate the period containing `currentCalendarDate`, update the Custom filter, and reload once.

- [ ] **Step 4: Delete the obsolete calendar component and dead imports/styles**

Delete `src/components/common/TransactionCalendar.vue` now that both list pages use `TransactionPeriodNavigator`. Remove its remaining import and global registration from `src/desktop-main.ts`, its Vue DatePicker-specific transaction-calendar styles from both list pages, all Gallery-only helpers, and all `TransactionListPageType.Calendar/Gallery` branches. Keep the numeric compatibility values only where route parsing needs to recognize old URLs; do not expose them through `values()` or UI.

- [ ] **Step 5: Run desktop manual checks**

Verify at `/desktop.html`:

1. One mixed list shows both expense and income; no mode selector, Gallery, Calendar-only view, or pagination remains.
2. The week strip, expanded financial-period calendar, populated-date scrolling, empty-date marker, and manual scroll synchronization match mobile.
3. Start days 10 and 31 navigate correct adjacent periods, including February clamp.
4. Refresh and browser back/forward preserve the period and explicit selected date without adding history entries during scroll.
5. Old `pageType=1` and `pageType=2` links open the unified list.
6. Quick-add remains visible and saves; filters, batch selection, details, edit dialog, and transaction pictures still work.
7. Changing **Financial Month Starts On** recalculates the period containing the selected date.

- [ ] **Step 6: Run final verification and commit**

Run:

```bash
npm run lint
npm run test
git diff --stat
git add src/desktop-main.ts src/router/desktop.ts src/stores/transaction.ts src/views/desktop/transactions/ListPage.vue src/components/common/TransactionCalendar.vue
git commit -m "feat: unify desktop transaction calendar list"
```

Expected: all manual checks are observed; lint and all tests pass; the protected mobile editor and desktop edit dialog never appear in the diff.

After the commit, run `git status --short`, `git log -6 --oneline`, and one final `git diff HEAD~6..HEAD --stat` to confirm exactly six feature commits and no out-of-scope files.
