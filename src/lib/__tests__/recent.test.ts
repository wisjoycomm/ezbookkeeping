import { describe, expect, it } from 'vitest';

import { TransactionType } from '@/core/transaction.ts';
import { CategoryType } from '@/core/category.ts';
import { Transaction } from '@/models/transaction.ts';
import { TransactionCategory } from '@/models/transaction_category.ts';
import {
    RECENT_WINDOW_SECONDS,
    flattenLeafCategories,
    getRecentCategoryIds,
    getLastUsedAccountId
} from '@/lib/recent.ts';

const NOW = 1_785_000_000;

function category(id: string, parentId: string, displayOrder: number, subCategories?: TransactionCategory[]): TransactionCategory {
    return TransactionCategory.of({
        id: id,
        name: 'category ' + id,
        parentId: parentId,
        type: CategoryType.Expense,
        icon: '1',
        color: '000000',
        comment: '',
        displayOrder: displayOrder,
        hidden: false,
        subCategories: subCategories
    });
}

function transaction(categoryId: string, accountId: string, time: number, type: number = TransactionType.Expense): Transaction {
    const t = Transaction.createNewTransaction(type, time, 'Asia/Ho_Chi_Minh', 420);
    t.setCategoryId(categoryId);
    t.sourceAccountId = accountId;
    return t;
}

describe('flattenLeafCategories', () => {
    it('should return only sub-categories, never the primary', () => {
        const tree = [category('1', '0', 1, [category('11', '1', 1), category('12', '1', 2)])];
        expect(flattenLeafCategories(tree).map(c => c.id)).toEqual(['11', '12']);
    });

    it('should drop a primary category that has no sub-categories', () => {
        expect(flattenLeafCategories([category('1', '0', 1, [])])).toEqual([]);
    });
});

describe('getRecentCategoryIds', () => {
    const leaves = flattenLeafCategories([
        category('1', '0', 1, [category('11', '1', 1), category('12', '1', 2), category('13', '1', 3)])
    ]);

    it('should rank by frequency descending', () => {
        const transactions = [
            transaction('12', 'a', NOW - 100),
            transaction('11', 'a', NOW - 200),
            transaction('12', 'a', NOW - 300)
        ];
        expect(getRecentCategoryIds(transactions, TransactionType.Expense, leaves, 4, NOW)).toEqual(['12', '11', '13']);
    });

    it('should break frequency ties on most recent use', () => {
        const transactions = [
            transaction('11', 'a', NOW - 500),
            transaction('12', 'a', NOW - 100)
        ];
        expect(getRecentCategoryIds(transactions, TransactionType.Expense, leaves, 2, NOW)).toEqual(['12', '11']);
    });

    it('should ignore transactions outside the window', () => {
        const transactions = [transaction('13', 'a', NOW - RECENT_WINDOW_SECONDS - 1)];
        expect(getRecentCategoryIds(transactions, TransactionType.Expense, leaves, 3, NOW)).toEqual(['11', '12', '13']);
    });

    it('should ignore transactions of another type', () => {
        const transactions = [transaction('13', 'a', NOW - 100, TransactionType.Income)];
        expect(getRecentCategoryIds(transactions, TransactionType.Expense, leaves, 3, NOW)).toEqual(['11', '12', '13']);
    });

    it('should fall back to display order when there is no history', () => {
        expect(getRecentCategoryIds([], TransactionType.Expense, leaves, 2, NOW)).toEqual(['11', '12']);
    });

    it('should pad with unused categories in display order', () => {
        const transactions = [transaction('13', 'a', NOW - 100)];
        expect(getRecentCategoryIds(transactions, TransactionType.Expense, leaves, 3, NOW)).toEqual(['13', '11', '12']);
    });

    it('should never return a category id that is not a known leaf', () => {
        const transactions = [transaction('99', 'a', NOW - 100)];
        expect(getRecentCategoryIds(transactions, TransactionType.Expense, leaves, 3, NOW)).toEqual(['11', '12', '13']);
    });

    it('should respect the limit', () => {
        expect(getRecentCategoryIds([], TransactionType.Expense, leaves, 1, NOW)).toEqual(['11']);
    });
});

describe('getLastUsedAccountId', () => {
    it('should return the account of the most recent matching transaction', () => {
        const transactions = [
            transaction('11', 'acc-old', NOW - 900),
            transaction('11', 'acc-new', NOW - 100)
        ];
        expect(getLastUsedAccountId(transactions, TransactionType.Expense, ['acc-old', 'acc-new'])).toBe('acc-new');
    });

    it('should ignore transactions of another type', () => {
        const transactions = [transaction('11', 'acc-income', NOW - 100, TransactionType.Income)];
        expect(getLastUsedAccountId(transactions, TransactionType.Expense, ['acc-income'])).toBeUndefined();
    });

    it('should ignore accounts that are no longer visible', () => {
        const transactions = [transaction('11', 'acc-hidden', NOW - 100)];
        expect(getLastUsedAccountId(transactions, TransactionType.Expense, ['acc-visible'])).toBeUndefined();
    });

    it('should return undefined with no history', () => {
        expect(getLastUsedAccountId([], TransactionType.Expense, ['acc-visible'])).toBeUndefined();
    });
});
