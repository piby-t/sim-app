import type { NameValue, SesKeyType } from '$lib/types';

/**
 * セッションごとのコンテキスト（一時的な状態）を管理するオブジェクト
 * 認可コードフローや FIDO 登録・認証プロセスにおいて、
 * 取得した値を一時的にメモリに保持し、再利用するために使用します。
 */
// Key: simses, Value: 各種トークンや FIDO パラメータのレコード
const contextMap = new Map<string, Record<string, string>>();

export const SessionContext = {
    /**
     * 指定したセッションの状態（値）を更新・保存します。
     * @param simses セッション識別子
     * @param key 保存する値の種別 (code, accessToken, challenge 等)
     * @param value 保存する文字列
     */
    setValue(simses: string, key: SesKeyType, value: string) {
        const current = contextMap.get(simses) || {};
        current[key] = value;
        contextMap.set(simses, current);
        
        console.log(`[Context Update] session: ${simses}, key: ${key}`);
    },

    /**
     * 【追加】指定したキーの値を個別に取得します。
     * @param simses セッション識別子
     * @param key 取得したい値の種別
     * @returns 保存されている文字列、存在しない場合は空文字
     */
    getValue(simses: string, key: SesKeyType): string {
        const data = contextMap.get(simses);
        if (!data) return '';
        return data[key] || '';
    },

    /**
     * 指定したセッションの値をすべて取得し、UIやAPIリクエストで使いやすい NameValue 配列形式で返します。
     * FIDO 関連のパラメータ（challenge, rpId 等）も含まれます。
     * @param simses セッション識別子
     * @returns リクエストパラメータとして利用可能な NameValue 配列
     */
    getAsNameValues(simses: string): NameValue[] {
        const data = contextMap.get(simses) || {};
        
        // 既存の OAuth トークン類に加えて、FIDO 用の主要なキーも返却対象に含めます
        const keys: { label: string; key: string }[] = [
            { label: 'code', key: 'code' },
            { label: 'access_token', key: 'accessToken' },
            { label: 'refresh_token', key: 'refreshToken' },
            { label: 'id_token', key: 'idToken' },
            { label: 'challenge', key: 'challenge' },
            { label: 'rpId', key: 'rpId' },
            { label: 'userId', key: 'userId' }
        ];

        return keys.map(k => ({
            name: k.label,
            value: data[k.key] || ''
        }));
    }
};