# Simplified Desktop Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show only Overview, Transaction Details, Accounts, and Statistics & Analysis in the desktop sidebar by default, with one setting that restores all secondary links.

**Architecture:** Add one cloud-synced boolean to the existing application-settings model and store. `MainLayout.vue` reads it reactively to gate secondary links, while the existing Application Settings page exposes the same Enable/Disable selector pattern already used for the desktop Add Transaction shortcut.

**Tech Stack:** Vue 3, Pinia, Vuetify, TypeScript, vue-i18n, Vitest

## Global Constraints

- Default desktop navigation contains exactly Overview, Transaction Details, Accounts, and Statistics & Analysis.
- `showAdvancedNavigation` defaults to `false` and is cloud-synced.
- Hiding navigation must not remove or guard routes, pages, data, APIs, or page-specific settings.
- Mobile navigation remains unchanged.
- Use 4-space indentation in TypeScript and Vue files.
- Do not modify `src/views/mobile/transactions/EditPage.vue` or `src/views/desktop/transactions/list/dialogs/EditDialog.vue`.
- `npm run lint` and `npm run test` must pass before completion.

---

### Task 1: Advanced navigation application setting

**Files:**
- Create: `src/core/__tests__/setting.test.ts`
- Modify: `src/core/setting.ts:48-50,137-139,208-210`
- Modify: `src/stores/setting.ts:206-212,602-604`

**Interfaces:**
- Produces: `ApplicationSettings.showAdvancedNavigation: boolean`
- Produces: `settingsStore.setShowAdvancedNavigation(value: boolean): void`
- Persists locally through `updateApplicationSettingsValue()` and to cloud through `updateUserApplicationCloudSettingValue()`.

- [ ] **Step 1: Write the failing setting contract test**

```ts
import { describe, expect, it } from 'vitest';

import {
    ALL_ALLOWED_CLOUD_SYNC_APP_SETTING_KEY_TYPES,
    DEFAULT_APPLICATION_SETTINGS,
    UserApplicationCloudSettingType
} from '@/core/setting.ts';

describe('advanced navigation setting', () => {
    it('is disabled by default and cloud-synced as a boolean', () => {
        expect(DEFAULT_APPLICATION_SETTINGS.showAdvancedNavigation).toBe(false);
        expect(ALL_ALLOWED_CLOUD_SYNC_APP_SETTING_KEY_TYPES.showAdvancedNavigation)
            .toBe(UserApplicationCloudSettingType.Boolean);
    });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run src/core/__tests__/setting.test.ts`

Expected: FAIL because `showAdvancedNavigation` does not exist.

- [ ] **Step 3: Add the setting contract**

Add the property to `ApplicationSettings`, cloud allowlist, and defaults:

```ts
// Navigation Bar
showAddTransactionButtonInDesktopNavbar: boolean;
showAdvancedNavigation: boolean;
```

```ts
'showAdvancedNavigation': UserApplicationCloudSettingType.Boolean,
```

```ts
showAdvancedNavigation: false,
```

- [ ] **Step 4: Add the Pinia setter beside the existing navbar setter**

```ts
function setShowAdvancedNavigation(value: boolean): void {
    updateApplicationSettingsValue('showAdvancedNavigation', value);
    appSettings.value.showAdvancedNavigation = value;
    updateUserApplicationCloudSettingValue('showAdvancedNavigation', value);
}
```

Return `setShowAdvancedNavigation` from the store under `// -- Navigation Bar`.

- [ ] **Step 5: Run the focused test and typecheck**

Run: `npx vitest run src/core/__tests__/setting.test.ts`

Expected: 1 test passes.

Run: `npx vue-tsc --noEmit`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/core/setting.ts src/core/__tests__/setting.test.ts src/stores/setting.ts
git commit -m "feat: add advanced navigation setting"
```

---

### Task 2: Simplified desktop sidebar and setting control

**Files:**
- Modify: `src/views/desktop/MainLayout.vue:47-110,299-300`
- Modify: `src/views/desktop/app/settings/tabs/AppBasicSettingTab.vue:89-101,573-576`
- Modify: `src/locales/en.json`
- Modify: `src/locales/vi.json`

**Interfaces:**
- Consumes: `settingsStore.appSettings.showAdvancedNavigation`
- Consumes: `settingsStore.setShowAdvancedNavigation(value: boolean): void`
- Produces: the **Show Advanced Navigation** Enable/Disable selector.

- [ ] **Step 1: Add English and Vietnamese labels**

Add the same key near other `Show...` strings in both locale files:

```json
"Show Advanced Navigation": "Show Advanced Navigation"
```

```json
"Show Advanced Navigation": "Hiển thị điều hướng nâng cao"
```

- [ ] **Step 2: Add the reactive setting control**

Add a second column to the existing Navigation Bar row:

```vue
<v-col cols="12" md="6">
    <v-select
        item-title="displayName"
        item-value="value"
        persistent-placeholder
        :label="tt('Show Advanced Navigation')"
        :placeholder="tt('Show Advanced Navigation')"
        :items="enableDisableOptions"
        v-model="showAdvancedNavigation"
    />
</v-col>
```

Add the computed setter beside `showAddTransactionButtonInDesktopNavbar`:

```ts
const showAdvancedNavigation = computed<boolean>({
    get: () => settingsStore.appSettings.showAdvancedNavigation,
    set: (value) => settingsStore.setShowAdvancedNavigation(value)
});
```

- [ ] **Step 3: Gate secondary desktop navigation links**

Add this computed value in `MainLayout.vue`:

```ts
const showAdvancedNavigation = computed<boolean>(() => settingsStore.appSettings.showAdvancedNavigation);
```

Add `v-if="showAdvancedNavigation"` to the list items for Insights Explorer, Transaction Categories, Transaction Tags, Transaction Templates, Exchange Rates Data, Use on Mobile Device, and About. Change the Scheduled Transactions condition to:

```vue
<li class="nav-link" v-if="showAdvancedNavigation && isUserScheduledTransactionEnabled()">
```

Gate the Miscellaneous section title with `v-if="showAdvancedNavigation"`. Do not gate Overview, Transaction Details, Statistics & Analysis, Accounts, Transaction Data, or Basis Data.

- [ ] **Step 4: Run automated verification**

Run: `npm run lint`

Expected: exit 0 with no TypeScript or ESLint errors.

Run: `npm run test`

Expected: all Vitest tests pass.

- [ ] **Step 5: Verify desktop behavior in the running app**

Open `http://localhost:8081/desktop.html` and log in with the configured demo account.

Verify:

1. The default sidebar shows only Overview, Transaction Details, Statistics & Analysis, and Accounts.
2. Open Application Settings from the avatar menu.
3. Set **Show Advanced Navigation** to Enable.
4. Confirm all eight secondary destinations return immediately, with Scheduled Transactions present only when the server feature is enabled.
5. Disable the setting and confirm the secondary links disappear immediately.
6. Open `/insights/explorer` directly and confirm the page still loads while its menu link is hidden.

- [ ] **Step 6: Confirm the scope boundary**

Run:

```bash
git status --short -- src/views/mobile/transactions/EditPage.vue src/views/desktop/transactions/list/dialogs/EditDialog.vue
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/views/desktop/MainLayout.vue src/views/desktop/app/settings/tabs/AppBasicSettingTab.vue src/locales/en.json src/locales/vi.json
git commit -m "feat: simplify desktop navigation"
```

- [ ] **Step 8: Update Kaneo**

Move EBK-7 from In Progress to In Review. Do not move it to Done; review owns that transition.
