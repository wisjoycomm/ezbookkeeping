import type { Transaction } from '@/models/transaction.ts';
import type { TransactionCategory } from '@/models/transaction_category.ts';

// Transactions older than this do not influence the suggested categories.
export const RECENT_WINDOW_SECONDS: number = 30 * 24 * 60 * 60;

interface CategoryUsage {
    count: number;
    lastUsedTime: number;
}

// A transaction must reference a leaf category; the API rejects primary ones (error 206005).
export function flattenLeafCategories(categories: TransactionCategory[]): TransactionCategory[] {
    const leaves: TransactionCategory[] = [];

    for (const category of categories) {
        const subCategories = category.subCategories;

        if (!subCategories || !subCategories.length) {
            continue;
        }

        for (const subCategory of subCategories) {
            if (subCategory.visible) {
                leaves.push(subCategory);
            }
        }
    }

    return leaves;
}

export function getRecentCategoryIds(transactions: Transaction[], transactionType: number, leafCategories: TransactionCategory[], limit: number, nowUnixTime: number): string[] {
    const knownIds = new Set<string>(leafCategories.map(category => category.id));
    const usages = new Map<string, CategoryUsage>();
    const earliestTime = nowUnixTime - RECENT_WINDOW_SECONDS;

    for (const transaction of transactions) {
        if (transaction.type !== transactionType || transaction.time < earliestTime) {
            continue;
        }

        const categoryId = transaction.categoryId;

        if (!knownIds.has(categoryId)) {
            continue;
        }

        const usage = usages.get(categoryId);

        if (usage) {
            usage.count += 1;
            usage.lastUsedTime = Math.max(usage.lastUsedTime, transaction.time);
        } else {
            usages.set(categoryId, { count: 1, lastUsedTime: transaction.time });
        }
    }

    const ranked = Array.from(usages.entries()).sort((left, right) => {
        if (left[1].count !== right[1].count) {
            return right[1].count - left[1].count;
        }

        return right[1].lastUsedTime - left[1].lastUsedTime;
    }).map(entry => entry[0]);

    const result: string[] = ranked.slice(0, limit);

    if (result.length >= limit) {
        return result;
    }

    const chosen = new Set<string>(result);
    const byDisplayOrder = leafCategories.slice().sort((left, right) => left.displayOrder - right.displayOrder);

    for (const category of byDisplayOrder) {
        if (result.length >= limit) {
            break;
        }

        if (!chosen.has(category.id)) {
            result.push(category.id);
            chosen.add(category.id);
        }
    }

    return result;
}

export function getLastUsedAccountId(transactions: Transaction[], transactionType: number, visibleAccountIds: string[]): string | undefined {
    const visible = new Set<string>(visibleAccountIds);
    let latest: Transaction | undefined = undefined;

    for (const transaction of transactions) {
        if (transaction.type !== transactionType || !visible.has(transaction.sourceAccountId)) {
            continue;
        }

        if (!latest || transaction.time > latest.time) {
            latest = transaction;
        }
    }

    return latest ? latest.sourceAccountId : undefined;
}
