import { HistoryManager } from '$lib/server/history-manager';
import type { PageServerLoad } from './$types';

/**
 * FIDO認証チャレンジ結果ページサーバーのロード関数。
 * 最新の履歴レコードから認証チャレンジの結果を抽出し、ページに表示するためのデータを準備します。
 * @param {Object} params - SvelteKitのロード関数パラメータ。
 * @param {Cookies} params.cookies - クッキーオブジェクト。セッションIDやFIDO関連のIDを取得するために使用します。
 * @param {App.Locals} params.locals - ローカル変数オブジェクト。セッションIDを取得するために使用します。
 * @returns {Promise<Object>} ページに渡すプロパティを含むオブジェクト。
 */
export const load: PageServerLoad = async ({ cookies, locals }) => {
    // セッションコンテキストを取得します。
    // 優先順位: locals -> cookies -> 'default-session'
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    // 指定されたセッションの最新の履歴レコードを取得します。
    const lastRecord = HistoryManager.getLastRecord(simses);
    // 履歴レコードをシリアライズ可能な形式に変換します。存在しない場合はnull。
    const serializedRecord = lastRecord ? JSON.parse(JSON.stringify(lastRecord)) : null;

    let rpId = null; // Relying Party IDを格納する変数
    let challenge = null; // 認証チャレンジを格納する変数
    let isSuccess = false; // 認証が成功したかどうかを示すフラグ

    // 最新のレコードが存在し、かつレスポンスのステータスコードが2xxの成功を示す場合
    if (serializedRecord?.res?.status >= 200 && serializedRecord?.res?.status < 300) {
        // レスポンスボディをパースします。文字列の場合はJSONとしてパース。
        const body = typeof serializedRecord.res.body === 'string' 
            ? JSON.parse(serializedRecord.res.body) 
            : serializedRecord.res.body;

        // FIDO関連のデータを取得します。publicKeyプロパティが存在すればそれを使用、そうでなければボディ全体を使用。
        const fidoData = body.publicKey || body;
        
        // rpIdを取得します。優先順位: fidoData.rpId -> fidoData.rp.id -> 'fido_last_rp_id'クッキー
        rpId = fidoData.rpId || fidoData.rp?.id || cookies.get('fido_last_rp_id');
        // challengeを取得します。優先順位: fidoData.challenge -> 'fido_last_challenge'クッキー
        challenge = fidoData.challenge || cookies.get('fido_last_challenge');
        
        // 認証フローでは通常userIdが存在しないため、チャレンジが存在すれば成功とみなします。
        if (challenge) {
            isSuccess = true;
        }
    }

    // ページに渡すデータを返します。
    return {
        record: serializedRecord, // 最新の履歴レコード
        rpId: rpId || '---', // Relying Party ID (存在しない場合は'---')
        challenge: challenge || '', // 認証チャレンジ (存在しない場合は空文字列)
        isSuccess // 認証成功フラグ
    };
};