# Simplified Desktop Navigation Design

**Kaneo:** EBK-7

## Goal

Keep the desktop sidebar focused on the four pages used for routine personal bookkeeping, while allowing the existing secondary pages to be restored from Application Settings.

## Default navigation

The following items are always visible:

- Overview
- Transaction Details
- Accounts
- Statistics & Analysis

The existing Add Transaction shortcut beside Transaction Details remains controlled by its existing setting.

## Advanced navigation

Add one cloud-synced boolean application setting named `showAdvancedNavigation`, displayed as **Show Advanced Navigation** in the existing Navigation Bar settings card. It defaults to disabled.

When enabled, the sidebar additionally shows:

- Insights Explorer
- Transaction Categories
- Transaction Tags
- Transaction Templates
- Scheduled Transactions, when the server feature is enabled
- Exchange Rates Data
- Use on Mobile Device
- About

The setting controls navigation visibility only. It does not remove routes, pages, data, APIs, or existing page-specific settings. Existing bookmarks and direct URLs continue to work.

## Implementation

- Add the setting to `ApplicationSettings`, the cloud-sync allowlist, and defaults.
- Add the matching setter to the settings store.
- Add one Enable/Disable selector to the desktop Navigation Bar settings card.
- Read the setting reactively in `MainLayout.vue` and conditionally render only the advanced links and the Miscellaneous section heading.
- Keep the Transaction Data and Basis Data section headings because each still contains an always-visible item.
- Do not change mobile navigation.

## Verification

- With the default setting, only the four main sidebar destinations are visible.
- Enabling Show Advanced Navigation restores all current secondary destinations.
- Disabling it hides them again without a reload.
- Direct navigation to `/insights/explorer` still works while advanced navigation is hidden.
- `npm run lint` and `npm run test` pass.
