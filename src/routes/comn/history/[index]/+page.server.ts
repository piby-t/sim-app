import { HistoryManager } from '$lib/server/history-manager';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * 履歴詳細表示画面用のサーバーサイドロード関数
 * 指定されたインデックスに基づき、過去の特定の通信記録を取得します。
 */
export const load: PageServerLoad = async ({ params, locals }) => {
    // 1. セッションIDに紐づく全ての履歴配列を取得
    const history = HistoryManager.getHistory(locals.simses);
    
    // 2. URLパラメータから対象のインデックスをパース
    const index = parseInt(params.index);
    
    /**
     * 3. 境界値・妥当性チェック
     * 数値でない場合や、配列の範囲外（存在しない履歴）が指定された場合は404エラーを返します。
     */
    if (isNaN(index) || !history[index]) {
        throw error(404, '履歴が見つかりません');
    }

    return {
        index,
        /**
         * 4. データのクローンと返却
         * SimHttp クラスのインスタンスをシリアライズ可能なプレーンオブジェクトに変換します。
         * これにより、フロントエンド側で安全に props として受け取ることが可能になります。
         */
        record: JSON.parse(JSON.stringify(history[index]))
    };
};