# Desktop Quick-Add — Design

**Date:** 2026-08-05
**Status:** Approved
**Scope:** Desktop counterpart to the mobile quick-add (sub-project 1)
**Companion spec:** `2026-08-05-mobile-quick-add-design.md`

## Problem

The desktop problem is **not** the mobile problem, and copying the mobile design here would solve
something that is not broken.

`src/views/desktop/transactions/list/dialogs/EditDialog.vue` already shows every field at once in
a single form, and its `two-column-select` pickers already support type-to-filter
(`:enable-filter="true"`). There is no modal-per-field cascade on desktop.

What is actually slow on PC:

1. **Adding requires opening a modal.** You click **Add** in the `ListPage` toolbar, a dialog
   covers the list you were reading, you fill it, you dismiss it. The context you were working in
   disappears for the duration.
2. **Transaction type is chosen inside the dialog**, so expense and income are not separated and
   the category picker must cover every type.
3. **There is no keyboard path.** Adding always starts with a mouse trip to the toolbar button.
   No global keyboard-shortcut mechanism exists anywhere in the desktop UI — only per-input
   `@keyup.enter` handlers — so nothing lets you start an entry from the keyboard.

## Goal

Add a routine expense or income without opening a modal and without leaving the keyboard, while
keeping the full dialog for everything else.

**Definition of done**

- An always-visible quick-add row sits above the transaction table on the desktop list page.
- Amount, category and account are settable inline; `Enter` from any of them saves.
- Expense and income are separated: the row's leading control fixes the type, and the category
  picker only ever loads that type's categories.
- `EditDialog.vue` is unmodified and the existing **Add** button still works exactly as now.
- Tab order runs amount → category → account → save, with no mouse trip required once focused.

## Non-goals

A global keyboard-shortcut system. It would be genuinely new machinery for this codebase, and the
row being permanently visible means it can be reached by click or Tab without one. If a hotkey is
wanted later it is an independent, additive change.

Also out of scope, as on mobile: tags, location, pictures, scheduled transactions, transfers, and
any visual restyle.

## Approach

An inline row rather than a lighter dialog. A dialog — however fast — still interrupts the list;
an inline row does not, which is the specific complaint on desktop.

As on mobile, this is **additive**: a new component beside `EditDialog.vue`, which is untouched.
The existing **Add** button and its dialog remain the path for transfers, tags, pictures,
back-dating, and anything else the row does not cover.

## Components

| File | Change | Purpose |
|---|---|---|
| `src/views/desktop/transactions/list/QuickAddRow.vue` | new | The inline entry row. |
| `src/views/desktop/transactions/ListPage.vue` | modified | Renders `QuickAddRow` above the table and reloads on its save. The existing `add()` handler and **Add** button are unchanged. |
| `src/lib/recent.ts` | **shared with mobile** | Same defaults logic, written once. |

`src/views/desktop/transactions/list/dialogs/EditDialog.vue` is **not** modified.

`lib/recent.ts` living in `src/lib/` is the one piece of real reuse between the two UIs — the
recency and default-account rules are identical on both platforms and must not be implemented
twice. Everything else is necessarily per-platform, because desktop and mobile are separate
component trees (Vuetify vs Framework7).

### Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ Chi │ Thu ]   50,000 ₫   │ Cà phê        ▾ │ Tiền mặt      ▾ │  Lưu   │
└──────────────────────────────────────────────────────────────────────────┘
   ↑ fixes the type          ↑ filterable      ↑ filterable
     and the category list     two-column-select, defaulted from recent
```

Reuses the existing `two-column-select` for both category and account — it already does
type-to-filter, so no new picker is needed. The amount is a plain text field with the existing
amount formatting.

### Interaction

- Focus starts in the amount field when the row is clicked or tabbed into.
- Tab order: type toggle → amount → category → account → **Lưu**.
- `Enter` in any field saves, when the entry is valid.
- After a successful save the row clears, keeps the chosen type and account, and returns focus to
  the amount field — so repeated entries cost only the amount and category.
- `Esc` clears the row.

## Spend/earn separation

The row's leading `Chi / Thu` toggle fixes the transaction type before anything else is entered,
and drives which `allCategories[CategoryType.X]` the category select loads. Expense and income
categories can never appear together in the row.

This differs from mobile — where the split is two separate entry points — because on desktop the
toggle is permanently visible rather than buried inside a form that must first be opened. The
outcome is the same: type is settled before the category list is built.

Transfers are not offered. They need a second account and a second amount, which does not fit a
single row, and they remain in the dialog.

## Defaults and recency

Identical to mobile, from the shared `src/lib/recent.ts`:

- **Category** — most-used category of the selected type in the last 30 days; falls back to
  display order with no history.
- **Account** — account of the most recent transaction of that type; falls back to the first
  visible account.
- **Time** — now.

The same known ceiling applies: `recent.ts` only sees transactions the store has loaded, so a cold
start falls back to display order. Deliberate trade for zero persistence; see the mobile spec for
the upgrade path.

## Save and failure handling

Reuses `saveTransaction()` (`src/stores/transaction.ts:1092`). No backend change.

- Save is disabled while the amount is zero or no category is selected.
- On failure the row keeps its contents and shows the error through the existing `snackbar` on
  `ListPage.vue` — the same channel `add()` already uses for dialog errors.
- On success `ListPage` reloads, matching what the dialog path already does.

The same two backend constraints as mobile apply: transactions must reference a **leaf** category
(so non-leaf categories must not be selectable in the row), and a transaction cannot predate its
account's balance-modification transaction (not reachable here, since the row always uses the
current time).

## Verification

- No new unit tests. `lib/recent.ts` is already covered by the mobile sub-project's
  `src/lib/__tests__/recent.test.ts`, and `QuickAddRow.vue` is a component in a repository with no
  component-test setup (vitest runs in a `node` environment with no DOM).
- `npm run lint` must pass — TypeScript is strict here, including `noUncheckedIndexedAccess`.
- Manual check against the local demo instance: add an expense and an income from the row, confirm
  no modal opens, confirm `Enter` saves, confirm the list refreshes, and confirm the existing
  **Add** button still opens the unchanged dialog.

## Sequencing against the mobile work

`lib/recent.ts` and its tests are built once, in the mobile sub-project. The desktop row depends
on it, so mobile lands first. Nothing else is shared, so after that the two can proceed in either
order.
