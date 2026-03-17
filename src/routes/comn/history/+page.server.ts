import { HistoryManager } from '$lib/server/history-manager';

/**
 * 履歴一覧画面用のサーバーサイドロード関数
 * 現在のセッションに関連付けられた全ての通信ログを取得し、クライアントへ渡します。
 */
export const load = async ({ locals }) => {
    // 1. セッションID (locals.simses) に基づいて、メモリ上の履歴配列を取得
    const history = HistoryManager.getHistory(locals.simses);

    return {
        /**
         * 2. データのシリアライズ
         * SimHttp クラスのインスタンス配列をプレーンな JSON オブジェクトに変換します。
         * SvelteKit の PageData としてフロントエンドへ安全に転送するための必須処理です。
         */
        history: JSON.parse(JSON.stringify(history))
    };
};