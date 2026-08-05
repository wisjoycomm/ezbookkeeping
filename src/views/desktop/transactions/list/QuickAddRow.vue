<template>
    <v-sheet border rounded class="quick-add-row pa-3 mb-4" @keyup.esc="reset">
        <div class="d-flex align-center ga-3 flex-wrap">
            <v-btn-toggle density="compact" color="primary" mandatory v-model="transactionType">
                <v-btn :value="TransactionType.Expense">{{ tt('Spend') }}</v-btn>
                <v-btn :value="TransactionType.Income">{{ tt('Earn') }}</v-btn>
            </v-btn-toggle>

            <div ref="amountInputContainer" class="quick-add-amount" @keyup.enter="save">
                <amount-input density="compact" :currency="selectedAccountCurrency" :show-currency="true"
                              :disabled="submitting" :label="tt('Amount')" :placeholder="tt('Amount')"
                              v-model="amount" />
            </div>

            <two-column-select class="quick-add-select"
                               primary-key-field="id" primary-value-field="id" primary-title-field="name"
                               primary-icon-field="icon" primary-icon-type="category" primary-color-field="color"
                               primary-hidden-field="hidden" primary-sub-items-field="subCategories"
                               secondary-key-field="id" secondary-value-field="id" secondary-title-field="name"
                               secondary-icon-field="icon" secondary-icon-type="category" secondary-color-field="color"
                               secondary-hidden-field="hidden"
                               :disabled="submitting || !leafCategories.length"
                               :enable-filter="true" :filter-placeholder="tt('Find category')" :filter-no-items-text="tt('No available category')"
                               :show-selection-primary-text="true"
                               :custom-selection-primary-text="selectedPrimaryCategoryName"
                               :custom-selection-secondary-text="selectedSecondaryCategoryName"
                               :label="tt('Category')" :placeholder="tt('Category')"
                               :items="categoryTree"
                               v-model="categoryId"
                               @keyup.enter="save" />

            <two-column-select class="quick-add-select"
                               primary-key-field="id" primary-value-field="category"
                               primary-title-field="name" primary-footer-field="displayBalance"
                               primary-icon-field="icon" primary-icon-type="account"
                               primary-sub-items-field="accounts"
                               :primary-title-i18n="true"
                               secondary-key-field="id" secondary-value-field="id"
                               secondary-title-field="name" secondary-footer-field="displayBalance"
                               secondary-icon-field="icon" secondary-icon-type="account" secondary-color-field="color"
                               :disabled="submitting || !visibleAccounts.length"
                               :enable-filter="true" :filter-placeholder="tt('Find account')" :filter-no-items-text="tt('No available account')"
                               :custom-selection-primary-text="selectedAccountName"
                               :label="tt('Account')" :placeholder="tt('Account')"
                               :items="visibleCategorizedAccounts"
                               v-model="accountId"
                               @keyup.enter="save" />

            <v-btn color="primary" :loading="submitting"
                   :disabled="submitting || !amount || !categoryId || !accountId"
                   @click="save">
                {{ tt('Save') }}
            </v-btn>
        </div>
    </v-sheet>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import { useI18n } from '@/locales/helpers.ts';
import { useAccountsStore } from '@/stores/account.ts';
import { useSettingsStore } from '@/stores/setting.ts';
import { useTransactionCategoriesStore } from '@/stores/transactionCategory.ts';
import { useTransactionsStore } from '@/stores/transaction.ts';
import { useUserStore } from '@/stores/user.ts';

import { Account, type CategorizedAccountWithDisplayBalance } from '@/models/account.ts';
import { Transaction } from '@/models/transaction.ts';
import type { TransactionCategory } from '@/models/transaction_category.ts';
import { CategoryType } from '@/core/category.ts';
import { TransactionType } from '@/core/transaction.ts';

import {
    getCurrentUnixTime,
    getSameDateTimeWithCurrentTimezone,
    getTimezoneOffsetMinutes,
    parseDateTimeFromUnixTimeWithBrowserTimezone
} from '@/lib/datetime.ts';
import { getTransactionPrimaryCategoryName, getTransactionSecondaryCategoryName } from '@/lib/category.ts';
import { generateRandomUUID } from '@/lib/misc.ts';
import { flattenLeafCategories, getLastUsedAccountId, getRecentCategoryIds } from '@/lib/recent.ts';
import { setChildInputFocus } from '@/lib/ui/desktop.ts';

const emit = defineEmits<{
    (e: 'saved'): void;
    (e: 'error', message: string): void;
}>();

const {
    tt,
    getCategorizedAccountsWithDisplayBalance
} = useI18n();

const accountsStore = useAccountsStore();
const settingsStore = useSettingsStore();
const transactionCategoriesStore = useTransactionCategoriesStore();
const transactionsStore = useTransactionsStore();
const userStore = useUserStore();

const amountInputContainer = useTemplateRef<HTMLElement>('amountInputContainer');

const transactionType = ref<number>(TransactionType.Expense);
const amount = ref<number>(0);
const categoryId = ref<string>('');
const accountId = ref<string>('');
const submitting = ref<boolean>(false);
const defaultsInitialized = ref<boolean>(false);

const loadedTransactions = computed<Transaction[]>(() =>
    transactionsStore.transactions.flatMap(month => month.items));

const categoryType = computed<number>(() =>
    transactionType.value === TransactionType.Income ? CategoryType.Income : CategoryType.Expense);

const categoryTree = computed<TransactionCategory[]>(() => {
    const categories = transactionCategoriesStore.allTransactionCategories[categoryType.value];
    return categories || [];
});

const leafCategories = computed<TransactionCategory[]>(() => flattenLeafCategories(categoryTree.value));
const visibleAccounts = computed<Account[]>(() => accountsStore.allVisiblePlainAccounts);

const visibleCategorizedAccounts = computed<CategorizedAccountWithDisplayBalance[]>(() =>
    getCategorizedAccountsWithDisplayBalance(
        visibleAccounts.value,
        settingsStore.appSettings.showAccountBalance,
        settingsStore.appSettings.accountCategoryOrders
    ));

const selectedPrimaryCategoryName = computed<string>(() =>
    getTransactionPrimaryCategoryName(categoryId.value, categoryTree.value));

const selectedSecondaryCategoryName = computed<string>(() =>
    getTransactionSecondaryCategoryName(categoryId.value, categoryTree.value));

const selectedAccount = computed<Account | undefined>(() =>
    visibleAccounts.value.find(account => account.id === accountId.value));

const selectedAccountName = computed<string>(() =>
    selectedAccount.value?.name || tt('None'));

const selectedAccountCurrency = computed<string>(() =>
    selectedAccount.value?.currency || userStore.currentUserDefaultCurrency);

function setDefaults(): void {
    const recentCategoryIds = getRecentCategoryIds(
        loadedTransactions.value,
        transactionType.value,
        leafCategories.value,
        6,
        getCurrentUnixTime()
    );
    const visibleAccountIds = visibleAccounts.value.map(account => account.id);

    categoryId.value = recentCategoryIds[0] || '';
    accountId.value = getLastUsedAccountId(loadedTransactions.value, transactionType.value, visibleAccountIds) || visibleAccountIds[0] || '';
}

function reset(): void {
    amount.value = 0;
    categoryId.value = '';
}

function focusAmount(): void {
    nextTick(() => setChildInputFocus(amountInputContainer.value ?? undefined, 'input'));
}

function getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }

    return String(error);
}

async function save(): Promise<void> {
    if (submitting.value || !amount.value || !categoryId.value || !accountId.value) {
        return;
    }

    const timeZone = settingsStore.appSettings.timeZone;
    const time = getSameDateTimeWithCurrentTimezone(
        parseDateTimeFromUnixTimeWithBrowserTimezone(getCurrentUnixTime())
    ).getUnixTime();
    const transaction = Transaction.createNewTransaction(
        transactionType.value,
        time,
        timeZone,
        getTimezoneOffsetMinutes(time, timeZone)
    );

    transaction.setCategoryId(categoryId.value);
    transaction.sourceAccountId = accountId.value;
    transaction.sourceAmount = amount.value;
    submitting.value = true;

    try {
        await transactionsStore.saveTransaction({
            transaction: transaction,
            defaultCurrency: userStore.currentUserDefaultCurrency,
            isEdit: false,
            clientSessionId: generateRandomUUID()
        });
        reset();
        emit('saved');
        focusAmount();
    } catch (error) {
        emit('error', getErrorMessage(error));
    } finally {
        submitting.value = false;
    }
}

watch(transactionType, () => {
    if (defaultsInitialized.value || !transactionsStore.transactionListStateInvalid) {
        setDefaults();
        defaultsInitialized.value = true;
    }
}, { immediate: true });

watch(() => transactionsStore.transactionListStateInvalid, invalid => {
    if (!invalid && !defaultsInitialized.value) {
        setDefaults();
        defaultsInitialized.value = true;
    }
}, { immediate: true });
</script>

<style scoped>
.quick-add-amount {
    width: 180px;
}

.quick-add-select {
    min-width: 220px;
    flex: 1;
}
</style>
