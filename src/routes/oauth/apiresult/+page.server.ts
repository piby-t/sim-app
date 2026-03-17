import { HistoryManager } from '$lib/server/history-manager';
import type { PageServerLoad } from './$types';

/**
 * 実行結果表示画面用のサーバーサイドロード関数
 * 直近に実行された通信記録を特定し、クライアントへ受け渡します。
 */
export const load: PageServerLoad = async ({ cookies }) => {
    // クッキーからセッションIDを取得（未設定時はデフォルトを使用）
    const simses = cookies.get('simses') || 'default-session';
    
    /**
     * 最新の実行記録 (SimHttp インスタンス) を取得
     */
    const lastRecord = HistoryManager.getLastRecord(simses);

    return {
        /**
         * SimHttp クラスのインスタンスをシリアライズ可能なオブジェクトに変換。
         * SvelteKit の data 経由で渡す際、Class形式のままだとエラーになる場合があるため、
         * JSON.parse/stringify を用いて純粋なデータオブジェクトとしてクローンします。
         */
        record: lastRecord ? JSON.parse(JSON.stringify(lastRecord)) : null
    };
};