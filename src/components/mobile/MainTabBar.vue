<template>
    <f7-toolbar tabbar icons bottom class="main-tabbar">
        <f7-link class="link" :class="{ 'tab-link-active': active === 'transactions' }" href="/transaction/list">
            <f7-icon f7="square_list"></f7-icon>
            <span class="tabbar-label">{{ tt('Details') }}</span>
        </f7-link>
        <f7-link class="link" :class="{ 'tab-link-active': active === 'accounts' }" href="/account/list">
            <f7-icon f7="creditcard"></f7-icon>
            <span class="tabbar-label">{{ tt('Accounts') }}</span>
        </f7-link>
        <!-- "homepage-add-button" must have the "dragenabled" class, otherwise the popover disappears immediately after the second long press -->
        <f7-link id="homepage-add-button" class="link dragenabled"
                 @click="showQuickAddTypeActions = true" @taphold="emit('taphold')">
            <f7-icon f7="plus_square" class="ebk-tarbar-big-icon"></f7-icon>
        </f7-link>
        <f7-link class="link" :class="{ 'tab-link-active': active === 'statistics' }" href="/statistic/transaction">
            <f7-icon f7="chart_pie"></f7-icon>
            <span class="tabbar-label">{{ tt('Statistics') }}</span>
        </f7-link>
        <f7-link class="link" :class="{ 'tab-link-active': active === 'settings' }" href="/settings">
            <f7-icon f7="gear_alt"></f7-icon>
            <span class="tabbar-label">{{ tt('Settings') }}</span>
        </f7-link>
    </f7-toolbar>

    <f7-actions v-model:opened="showQuickAddTypeActions">
        <f7-actions-group>
            <f7-actions-button @click="openQuickAdd(TransactionType.Expense)">{{ tt('Expense') }}</f7-actions-button>
            <f7-actions-button @click="openQuickAdd(TransactionType.Income)">{{ tt('Income') }}</f7-actions-button>
        </f7-actions-group>
        <f7-actions-group>
            <f7-actions-button bold @click="emit('moreDetails', '')">{{ tt('More Details') }}</f7-actions-button>
            <f7-actions-button close>{{ tt('Cancel') }}</f7-actions-button>
        </f7-actions-group>
    </f7-actions>

    <quick-add-sheet :transaction-type="quickAddTransactionType"
                     v-model:show="showQuickAddSheet"
                     @saved="emit('saved')"
                     @more-details="(query: string) => emit('moreDetails', query)"></quick-add-sheet>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import QuickAddSheet from '@/views/mobile/transactions/QuickAddSheet.vue';

import { useI18n } from '@/locales/helpers.ts';
import { TransactionType } from '@/core/transaction.ts';

defineProps<{
    // Which section this page belongs to, so its tab renders as the active one.
    active?: 'transactions' | 'accounts' | 'statistics' | 'settings';
}>();

const emit = defineEmits<{
    (e: 'taphold'): void;
    (e: 'saved'): void;
    (e: 'moreDetails', query: string): void;
}>();

const { tt } = useI18n();

const showQuickAddTypeActions = ref<boolean>(false);
const showQuickAddSheet = ref<boolean>(false);
const quickAddTransactionType = ref<number>(TransactionType.Expense);

function openQuickAdd(transactionType: number): void {
    quickAddTransactionType.value = transactionType;
    showQuickAddTypeActions.value = false;
    showQuickAddSheet.value = true;
}
</script>
