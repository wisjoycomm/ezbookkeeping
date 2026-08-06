<template>
    <f7-sheet class="quick-add-sheet" style="height: auto" swipe-to-close swipe-handler=".swipe-handler"
              :opened="show" @sheet:open="onSheetOpen" @sheet:closed="onSheetClosed">
        <div class="swipe-handler"></div>
        <f7-page-content class="no-padding-top">
            <div class="quick-add-header">
                <span class="quick-add-title">{{ tt(title) }}</span>
                <f7-link icon-f7="xmark" @click="close"></f7-link>
            </div>

            <div class="quick-add-section" v-if="!leafCategories.length">
                <span class="quick-add-empty">{{ tt('No available category') }}</span>
            </div>

            <div class="quick-add-section" v-else-if="leafCategories.length">
                <div class="quick-add-chips">
                    <f7-chip class="quick-add-chip"
                             :class="{ 'quick-add-chip-selected': category.id === categoryId }"
                             :key="category.id"
                             :text="category.name"
                             @click="categoryId = category.id"
                             v-for="category in chipCategories">
                        <template #media>
                            <ItemIcon icon-type="category" :icon-id="category.icon" :color="category.color"></ItemIcon>
                        </template>
                    </f7-chip>
                    <f7-chip class="quick-add-chip quick-add-chip-more"
                             :text="tt('All Categories')"
                             @click="showCategorySheet = true"></f7-chip>
                </div>
                <span class="quick-add-selected-name">{{ selectedCategoryName }}</span>
            </div>

            <div class="quick-add-section" v-if="visibleAccounts.length">
                <div class="quick-add-chips">
                    <f7-chip class="quick-add-chip"
                             :class="{ 'quick-add-chip-selected': account.id === accountId }"
                             :key="account.id"
                             :text="account.name"
                             @click="accountId = account.id"
                             v-for="account in visibleAccounts"></f7-chip>
                </div>
            </div>

            <number-pad ref="numberPad"
                        :live-update="true"
                        :min-value="TRANSACTION_MIN_AMOUNT"
                        :max-value="TRANSACTION_MAX_AMOUNT"
                        :currency="selectedAccountCurrency"
                        v-model="amount"
            ></number-pad>

            <div class="quick-add-actions">
                <f7-button class="quick-add-more" @click="openFullEditor">{{ tt('More Details') }}</f7-button>
                <f7-button class="quick-add-save" fill round
                           :class="{ 'disabled': !canSave }"
                           @click="save">{{ tt('Save') }}</f7-button>
            </div>

            <tree-view-selection-sheet primary-key-field="id" primary-title-field="name"
                                       primary-icon-field="icon" primary-icon-type="category" primary-color-field="color"
                                       primary-hidden-field="hidden" primary-sub-items-field="subCategories"
                                       secondary-key-field="id" secondary-value-field="id" secondary-title-field="name"
                                       secondary-icon-field="icon" secondary-icon-type="category" secondary-color-field="color"
                                       secondary-hidden-field="hidden"
                                       :enable-filter="true"
                                       :filter-placeholder="tt('Find category')"
                                       :filter-no-items-text="tt('No available category')"
                                       :items="categoryTree"
                                       v-model:show="showCategorySheet"
                                       v-model="categoryId">
            </tree-view-selection-sheet>
        </f7-page-content>
    </f7-sheet>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue';

import NumberPad from '@/components/mobile/NumberPad.vue';
import ItemIcon from '@/components/mobile/ItemIcon.vue';

import { useI18n } from '@/locales/helpers.ts';
import { useI18nUIComponents } from '@/lib/ui/mobile.ts';

import { useSettingsStore } from '@/stores/setting.ts';
import { useUserStore } from '@/stores/user.ts';
import { useAccountsStore } from '@/stores/account.ts';
import { useTransactionCategoriesStore } from '@/stores/transactionCategory.ts';
import { useTransactionsStore } from '@/stores/transaction.ts';

import { Transaction } from '@/models/transaction.ts';
import type { TransactionCategory } from '@/models/transaction_category.ts';
import type { Account } from '@/models/account.ts';
import { TransactionType } from '@/core/transaction.ts';
import { CategoryType } from '@/core/category.ts';
import { TRANSACTION_MIN_AMOUNT, TRANSACTION_MAX_AMOUNT } from '@/consts/transaction.ts';
import { getCurrentUnixTime, getTimezoneOffsetMinutes } from '@/lib/datetime.ts';
import { generateRandomUUID } from '@/lib/misc.ts';
import { flattenLeafCategories, getRecentCategoryIds, getLastUsedAccountId } from '@/lib/recent.ts';

const CHIP_COUNT: number = 6;

const props = defineProps<{
    show: boolean;
    transactionType: number;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'saved'): void;
    (e: 'moreDetails', query: string): void;
}>();

const { tt } = useI18n();
const { showToast } = useI18nUIComponents();

const settingsStore = useSettingsStore();
const userStore = useUserStore();
const accountsStore = useAccountsStore();
const transactionCategoriesStore = useTransactionCategoriesStore();
const transactionsStore = useTransactionsStore();

const numberPad = useTemplateRef<InstanceType<typeof NumberPad>>('numberPad');

const amount = ref<number>(0);
const categoryId = ref<string>('');
const accountId = ref<string>('');
const submitting = ref<boolean>(false);
const showCategorySheet = ref<boolean>(false);

const title = computed<string>(() => props.transactionType === TransactionType.Income ? 'Income' : 'Expense');

const categoryType = computed<number>(() =>
    props.transactionType === TransactionType.Income ? CategoryType.Income : CategoryType.Expense);

const categoryTree = computed<TransactionCategory[]>(() => {
    const categories = transactionCategoriesStore.allTransactionCategories[categoryType.value];
    return categories || [];
});

const leafCategories = computed<TransactionCategory[]>(() => flattenLeafCategories(categoryTree.value));

const visibleAccounts = computed<Account[]>(() => accountsStore.allVisiblePlainAccounts);

const loadedTransactions = computed<Transaction[]>(() =>
    transactionsStore.transactions.flatMap(month => month.items));

const chipCategories = computed<TransactionCategory[]>(() => {
    const byId = new Map<string, TransactionCategory>(leafCategories.value.map(category => [category.id, category]));
    const ids = getRecentCategoryIds(loadedTransactions.value, props.transactionType, leafCategories.value, CHIP_COUNT, getCurrentUnixTime());
    const result: TransactionCategory[] = [];

    for (const id of ids) {
        const category = byId.get(id);

        if (category) {
            result.push(category);
        }
    }

    return result;
});

const selectedCategoryName = computed<string>(() => {
    const category = leafCategories.value.find(item => item.id === categoryId.value);
    return category ? category.name : '';
});

const selectedAccount = computed<Account | undefined>(() =>
    visibleAccounts.value.find(account => account.id === accountId.value));

const selectedAccountCurrency = computed<string>(() =>
    selectedAccount.value?.currency || userStore.currentUserDefaultCurrency);

const canSave = computed<boolean>(() =>
    !submitting.value && !!amount.value && !!categoryId.value && !!accountId.value);

function setDefaults(): void {
    const ids = getRecentCategoryIds(loadedTransactions.value, props.transactionType, leafCategories.value, CHIP_COUNT, getCurrentUnixTime());
    const visibleAccountIds = visibleAccounts.value.map(account => account.id);

    amount.value = 0;
    categoryId.value = ids[0] || '';
    accountId.value = getLastUsedAccountId(loadedTransactions.value, props.transactionType, visibleAccountIds) || visibleAccountIds[0] || '';
}

function close(): void {
    emit('update:show', false);
}

function onSheetOpen(): void {
    setDefaults();
    numberPad.value?.resetInput();
}

function onSheetClosed(): void {
    close();
}

// The full editor is reached through query parameters rather than the transaction draft:
// saveTransactionDraft() is a no-op unless autoSaveTransactionDraft is enabled, so a draft
// hand-off would silently lose everything typed here on the default setting.
function openFullEditor(): void {
    const params: string[] = [`type=${props.transactionType}`];

    if (amount.value) {
        params.push(`amount=${amount.value}`);
    }

    if (categoryId.value) {
        params.push(`categoryId=${categoryId.value}`);
    }

    if (accountId.value) {
        params.push(`accountId=${accountId.value}`);
    }

    close();
    emit('moreDetails', params.join('&'));
}

function save(): void {
    if (!canSave.value) {
        return;
    }

    const timeZone = settingsStore.appSettings.timeZone;
    const time = getCurrentUnixTime();
    const transaction = Transaction.createNewTransaction(
        props.transactionType,
        time,
        timeZone,
        getTimezoneOffsetMinutes(time, timeZone)
    );

    transaction.setCategoryId(categoryId.value);
    transaction.sourceAccountId = accountId.value;
    transaction.sourceAmount = amount.value;

    submitting.value = true;

    transactionsStore.saveTransaction({
        transaction: transaction,
        defaultCurrency: userStore.currentUserDefaultCurrency,
        isEdit: false,
        clientSessionId: generateRandomUUID()
    }).then(() => {
        submitting.value = false;
        emit('saved');
        close();
    }).catch(error => {
        submitting.value = false;

        // Stay open with the entered values intact so a failed save never discards the input.
        if (error && typeof error === 'object' && 'message' in error) {
            showToast(String(error.message));
        } else if (error) {
            showToast(String(error));
        }
    });
}
</script>

<style>
.quick-add-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
}

.quick-add-title {
    font-size: 17px;
    font-weight: 600;
    text-transform: uppercase;
}

.quick-add-section {
    padding: 4px 16px 8px;
}

.quick-add-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.quick-add-chip {
    margin: 0;
}

.quick-add-chip-selected {
    background-color: var(--f7-theme-color);
    color: var(--f7-color-white);
}

.quick-add-chip-more {
    opacity: 0.7;
}

.quick-add-selected-name {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    opacity: 0.6;
}

.quick-add-empty {
    font-size: 14px;
    opacity: 0.6;
}

.quick-add-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px calc(12px + var(--f7-safe-area-bottom));
}

.quick-add-save {
    flex: 1;
}
</style>
