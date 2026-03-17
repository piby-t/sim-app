import type { JsonValue } from '$lib/types';

/**
 * データ構造を保ったまま、文字列内の変数を再帰的に置換します。
 */
export function resolveDeep<T>(data: T, params: Record<string, string>): T {
    if (typeof data === 'string') {
        const resolved = data.replace(/\${([\w-]+)}|#{([\w-]+)}/g, (_, p1, p2) => {
            const key = p1 || p2;
            return params[key] !== undefined ? params[key] : `\${${key}}`;
        });
        return resolved as unknown as T;
    }

    if (Array.isArray(data)) {
        return data.map((item) => resolveDeep(item, params)) as unknown as T;
    }

    if (data !== null && typeof data === 'object') {
        const resolvedObj: Record<string, JsonValue> = {};
        for (const [key, value] of Object.entries(data)) {
            resolvedObj[key] = resolveDeep(value as JsonValue, params);
        }
        return resolvedObj as unknown as T;
    }

    return data;
}