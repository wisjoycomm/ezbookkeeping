# Mobile Quick-Add — Design

**Date:** 2026-08-05
**Status:** Approved
**Scope:** Sub-project 1 of the mobile UX upgrade

## Problem

Logging a routine expense on mobile takes ~14 taps and four modal open/close cycles.
Entering a 50,000 ₫ coffee today:

1. tab-bar `+`
2. amount row → opens `NumberPadSheet`
3–7. five digits (VND amounts are 5–7 digits; there is no smaller denomination)
8. confirm the pad
9. category row → opens `TreeViewSelectionSheet`
10. primary category
11. secondary category (closes the sheet)
12. account row → opens a selection sheet
13. account
14. save ✓ (small target, top-right of the navbar)

The cause is structural: `src/views/mobile/transactions/EditPage.vue` renders every field as an
`f7-list-item` whose only behaviour is to open a sheet. Nothing is editable in place. The file is
76KB because the expense, income and transfer variants of each row are near-duplicate template
blocks.

Expense and income are also not separated. Transaction type is a segmented control *inside* the
form, so the category picker must handle every type and the user can pick the wrong one.

## Goal

Cut the *overhead* of logging a routine expense or income from 9 taps to 4, with spend and earn
as distinct actions from the start.

Digit entry is close to irreducible: the existing pad has only `0`–`9`, `× − +` and backspace, so
50,000 ₫ costs 5 taps. The meaningful measure is everything that is *not* the amount — today
that is 9 taps (open, four sheet open/close cycles, save), and this design targets 4
(`+`, Chi tiêu, category chip, LƯU).

For the 50,000 ₫ coffee example, end to end:

| | Today | Quick-add | Quick-add + `000` key |
|---|---|---|---|
| Overhead taps | 9 | 4 | 4 |
| Amount taps | 5 | 5 | 3 |
| **Total** | **14** | **9** | **7** |
| Modal open/close cycles | 4 | 0 | 0 |

**Approved addition — a `000` key.** VND has no denomination below 1,000, so nearly every amount
ends in at least three zeros. Adding one key to `NumberPad` removes two taps from almost every
entry, taking the coffee example to 7 taps total. It is additive for other currencies (an unused
extra key) and benefits `NumberPadSheet`'s existing callers too.

The key appends three zeros to the current value, subject to the same `TRANSACTION_MAX_AMOUNT`
clamp as any other digit input, and is a no-op when the value is empty or zero (so it cannot
produce a leading `000`).

**Definition of done**

- Tapping the tab-bar `+` offers Chi tiêu / Thu nhập; each opens a single-screen entry sheet.
- Amount, category and account are all visible and settable without opening a nested sheet.
- A routine entry — default account, a category present in the chips — costs 4 taps plus the
  digits of the amount.
- `EditPage.vue` is unmodified and every existing flow still works.
- `lib/recent.ts` has unit tests that pass.

## Non-goals

Tags, geographic location, pictures, scheduled transactions, transfers, and the entire desktop
UI. All of these stay in the existing full editor. This sub-project adds a fast path for the
common case; it does not replace the editor.

## Approach

Build a new sheet beside the existing editor rather than rewriting it.

The alternatives considered were (B) adding smart defaults to `EditPage` — smaller diff, but every
field stays a modal and it delivers no spend/earn split — and (C) rewriting `EditPage` as a fully
inline form — the better end state, but open-heart surgery on the most branch-heavy file in the
mobile tree (view/add/edit modes × 4 transaction types × template mode), risking regressions in
flows that are not used daily.

Approach A gets most of C's benefit at a fraction of the risk, because the new component sits
next to the old one. If quick-add proves itself in daily use, C stops being necessary: the full
editor becomes the rare advanced path, which is where it belongs.

## Components

| File | Change | Purpose |
|---|---|---|
| `src/components/mobile/NumberPad.vue` | new | The digit grid, extracted from `NumberPadSheet.vue`. Props/emits match the pad's existing value contract. |
| `src/components/mobile/NumberPadSheet.vue` | modified | Becomes a thin `f7-sheet` wrapper around `NumberPad`. Its public props and emits are unchanged, so all existing callers are untouched. |
| `src/views/mobile/transactions/QuickAddSheet.vue` | new | The one-screen entry surface. |
| `src/lib/recent.ts` | new | Pure functions deriving recent/most-used categories and the last-used account from a transaction array. |
| `src/views/mobile/HomePage.vue` | modified | Tab-bar `+` opens the Chi tiêu / Thu nhập chooser instead of navigating to `/transaction/add`. Long-press behaviour is unchanged. |

`src/views/mobile/transactions/EditPage.vue` is **not** modified.

The extraction of `NumberPad` is required, not incidental: the pad markup is currently welded
inside `f7-sheet` in `NumberPadSheet.vue`, so it cannot be rendered inline without separating it.

### QuickAddSheet layout

```
┌─────────────────────────────┐
│  CHI TIÊU            ✕      │
│                             │
│         50,000 ₫            │   amount display
│                             │
│  ☕ Cà phê  🍜 Ăn trưa      │   category chips,
│  🛵 Grab    🍳 Ăn sáng      │   most-used first
│  ⌄ tất cả danh mục          │   → falls through to full picker
│                             │
│  [Tiền mặt] MoMo  VCB  Visa │   account strip, last-used preselected
│                             │
│   1    2    3               │
│   4    5    6               │   inline NumberPad
│   7    8    9               │
│  000   0    ⌫   (proposed)  │
│                             │
│  Chi tiết…      [   LƯU   ] │
└─────────────────────────────┘
```

- **Chi tiết…** navigates to `/transaction/add` with the current draft prefilled, via the existing
  `saveTransactionDraft()` (`src/stores/transaction.ts:541`).
- **⌄ tất cả danh mục** opens the existing `TreeViewSelectionSheet` for the full category tree,
  for the case where the wanted category is not among the chips.

## Spend/earn separation

Transaction type is fixed at the entry point, not chosen inside the form. `QuickAddSheet` takes
the type as a prop and loads only `allCategories[CategoryType.Expense]` or
`allCategories[CategoryType.Income]`.

Category separation therefore falls out of the entry-point split rather than needing to be
enforced inside the picker. There is no code path in quick-add where expense and income
categories can appear together.

Transfers are not offered in quick-add. They need two accounts and two amounts, which would make
the sheet substantially denser for an action that is rare.

## Defaults and recency

`lib/recent.ts` derives its data from the transactions already loaded in the transaction store.
It adds no new API, no new persisted state, and no migration.

- **Category chips** — the most-used categories of the given type in the last 30 days, ordered by
  frequency descending. Ties break on most recent use. When there is no history, falls back to
  the user's category display order.
- **Account** — the account used in the most recent transaction of that type. When there is no
  history, the first visible account.
- **Time** — now.

**Known ceiling:** this only sees transactions the store has loaded, so on a cold start with an
empty store the chips fall back to display order. This is a deliberate trade for zero persistence.
If it proves annoying in daily use, the upgrade path is a small localStorage counter written
through the existing `updateApplicationSettingsValue()` in `src/lib/settings.ts`; that would
require adding a key to `ApplicationSettingKey`.

## Save and failure handling

Saving calls the existing `saveTransaction({ transaction, defaultCurrency, isEdit: false,
clientSessionId })` in `src/stores/transaction.ts:1092`. No backend change and no new endpoint.

- Save is disabled while the amount is zero or no category is selected.
- On failure the sheet stays open and shows the error inline. A rejected save never discards
  what was typed.
- On success the sheet closes and the underlying list/overview refreshes through the store's
  existing invalidation.

Two backend constraints already discovered, which quick-add must respect and which its error
messages should surface intelligibly:

- Transactions must reference a **leaf** category. A top-level category with no children cannot
  be used, and must not appear as a chip.
- A transaction cannot be dated before its account's balance-modification transaction
  (error 205028). Quick-add always uses the current time, so this only matters if backdating is
  added later.

## Verification

- `src/lib/__tests__/recent.test.ts` — `lib/recent.ts` is pure functions over a transaction array,
  so it is directly testable: frequency ranking, tie-break on recency, empty history fallback,
  type filtering, and exclusion of non-leaf categories.
- `npm run lint` must pass. TypeScript is strict here, including `noUncheckedIndexedAccess`, so
  indexed access into the category and account maps must be narrowed.
- Manual check against the local demo instance: log an expense and an income, confirm the tap
  count and that both appear correctly in the list and overview.

No component test for `QuickAddSheet`. The repository has no component-test setup (vitest runs in
a `node` environment with no DOM), and adding one is out of scope for this sub-project.

## Remaining sub-projects

This is sub-project 1 of 5 in the mobile UX upgrade. The others get their own specs:

2. Transaction list — Chi tiêu / Thu nhập tabs, inline edit
3. Filter and search consolidation
4. Overview — separate spend/earn blocks
5. Category separation in the remaining surfaces (statistics, filters)
