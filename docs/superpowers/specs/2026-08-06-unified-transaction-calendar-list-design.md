# Unified Transaction Calendar List Design

**Date:** 2026-08-06
**Status:** Approved
**Platforms:** Mobile and desktop

## Goal

Make the transaction list the single place for reviewing day-to-day finances:

- keep expense and income transactions together;
- embed calendar navigation into the list instead of maintaining a separate Calendar mode;
- remove Gallery from the visible transaction modes; and
- let the user define when their financial month begins.

The result should make a particular day quick to reach without hiding the surrounding transactions.

## Selected approach

Use one financial period at a time. A compact week strip remains above the mixed transaction list, and the period header expands a full calendar inline.

This replaces the current List, Calendar, and Gallery mode selector. List becomes the only visible transaction view. The existing transaction details and editors continue to show attached pictures.

The alternatives rejected were a permanently expanded month, which consumes too much mobile space, and an on-demand calendar drawer, which makes date navigation harder to discover.

## Financial month

Add one cloud-synced application setting named **Financial month starts on**, shared by mobile and desktop.

- Allowed values are 1 through 31.
- The default is 1, preserving normal calendar months.
- If the chosen day does not exist in a month, use that month's final day.
- A period begins at the resolved start day and ends immediately before the next month's resolved start day.
- The period is named for its starting month.

For a start day of 10, **August 2026** means 10 August through 9 September.

For a start day of 31 in a non-leap year, consecutive periods include:

- 31 January through 27 February;
- 28 February through 30 March; and
- 31 March through 29 April.

This produces contiguous periods with no missing or overlapping days.

The existing credit-card statement date is not reused. It belongs to one credit-card account and is only available when the selected account filter resolves to that card; this transaction list mixes accounts and needs one stable application-wide period.

## Layout

From top to bottom, both platforms show:

1. A period header with previous/next controls, the starting-month name, the exact start/end dates, and a control to expand or collapse the calendar.
2. Existing period totals, with expense and income shown separately as summaries only.
3. A compact seven-day strip containing the selected date.
4. One chronological transaction list containing both expense and income.

The expanded calendar represents the complete financial period, including dates from the following Gregorian month when required. Dates outside the active financial period may appear to complete a calendar week but are visually muted and are not selectable.

Desktop and mobile use their existing component systems, but expose the same information and behavior. No cross-framework UI abstraction is introduced.

## Date and scroll interaction

Selecting a date in either calendar does not filter the list. It scrolls the complete period list to that date, preserving nearby days and transactions.

- If the selected date has transactions, the first transaction for that date becomes the scroll target.
- If it has none, insert a temporary **No transactions on this day** marker at that date's chronological position and scroll to it.
- Changing the selected date removes the previous temporary marker.
- Manual list scrolling selects the date of the first visible transaction group and updates the week strip.
- When the selected week changes, the week strip follows it.
- Navigating to another financial period loads that complete period and selects its start date.
- Opening the current period initially selects today.

The list remains in the application's current newest-first order. The marker follows that same order.

## Loading and URL state

Each financial period is loaded in full, using the same all-transactions loading path already required by the current monthly Calendar mode. This avoids trying to scroll to an unloaded day through desktop pagination or mobile infinite scrolling.

The active period and selected date remain representable in the existing transaction-list query state so refresh, history navigation, and shared URLs reopen the same context. A date selected only by scrolling may update the URL with replacement rather than creating a browser-history entry for every scroll event.

No backend endpoint or transaction model change is required.

## Gallery and existing routes

- Remove Calendar and Gallery from the visible transaction mode selector.
- Do not delete transaction pictures or their detail/editor UI.
- Preserve existing Calendar and Gallery route/query inputs as compatibility redirects into the unified list for old bookmarks.
- Do not split expense and income into tabs or separate lists.

## Settings

Place **Financial month starts on** in the existing application settings area that contains date and display preferences. The control accepts integers from 1 through 31 and explains the short-month clamp in helper text.

Changing the value recalculates the current period immediately. The view should choose the newly calculated period that contains the currently selected date, preventing an unexpected jump to an unrelated month.

## Empty, loading, and failure states

- A period with no transactions still shows its calendar and the normal empty-list state.
- Selecting a date in an otherwise non-empty period can show the temporary no-transactions marker between surrounding date groups.
- Existing loading indicators and transaction-load error reporting remain in use.
- The previous list remains stable until replacement period data is ready where the existing store permits it.

## Accessibility

- Date controls remain keyboard reachable on desktop.
- The selected date exposes its selected state to assistive technology.
- Previous/next and expand/collapse controls have explicit labels.
- Expense and income are distinguishable by text/sign as well as color.
- Scroll synchronization must not repeatedly steal keyboard focus.

## Non-goals

- Changing transaction editing, quick-add, categories, accounts, or backend data.
- Removing picture attachments from transactions.
- Adding spend/earn tabs.
- Adding per-account financial-month settings.
- Adding new calendar or date dependencies.
- Redesigning unrelated filters or navigation.

## Verification

Automated checks should cover the financial-period boundary calculation, including start days 1, 28, 29, 30, and 31 across leap and non-leap February.

Manual checks on both mobile and desktop should confirm:

- the unified list contains expense and income together;
- Calendar and Gallery are absent from visible transaction modes;
- the compact week strip and expanded period calendar select the same date;
- selecting a populated date scrolls to its transaction group without filtering other dates;
- selecting an empty date inserts and reaches the temporary marker;
- manual scrolling updates the highlighted date and week;
- previous/next navigation loads the correct custom period;
- changing the start day recalculates the period containing the selected date;
- start day 31 clamps correctly in February; and
- existing transaction pictures remain accessible.

`npm run lint` and `npm run test` must pass before completion.
