import { describe, expect, it } from 'vitest';

import {
    ALL_ALLOWED_CLOUD_SYNC_APP_SETTING_KEY_TYPES,
    DEFAULT_APPLICATION_SETTINGS,
    UserApplicationCloudSettingType
} from '@/core/setting.ts';

describe('advanced navigation setting', () => {
    it('is disabled by default and cloud-synced as a boolean', () => {
        expect(DEFAULT_APPLICATION_SETTINGS.showAdvancedNavigation).toBe(false);
        // Bracket access is required: the allowlist is an index-signature type and
        // tsconfig sets noPropertyAccessFromIndexSignature.
        expect(ALL_ALLOWED_CLOUD_SYNC_APP_SETTING_KEY_TYPES['showAdvancedNavigation'])
            .toBe(UserApplicationCloudSettingType.Boolean);
    });
});
