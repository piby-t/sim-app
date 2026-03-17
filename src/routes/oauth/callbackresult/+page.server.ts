import { HistoryManager } from '$lib/server/history-manager';
import { SessionContext } from '$lib/server/session-context';
import type { PageServerLoad } from './$types';

/**
 * コールバック結果表示画面用のサーバーサイドロード関数
 * 受信した認可コードや state 検証結果、および現在のセッション状態を統合してクライアントへ渡します。
 */
export const load: PageServerLoad = async ({ locals }) => {
    // 1. 最新の実行記録（認可リクエスト〜レスポンス）を取得
    const lastRecord = HistoryManager.getLastRecord(locals.simses);
    
    // 2. 現在のセッションに保存されている全変数（code, accessToken等）を取得
    const contextValues = SessionContext.getAsNameValues(locals.simses);

    return {
        /**
         * SimHttp インスタンスをプレーンなオブジェクトに変換して返却
         * フロントエンドの UI で「何を送り、何が返ってきたか」を表示するために使用します。
         */
        record: lastRecord ? {
            req: lastRecord.req,
            res: lastRecord.res,
            timestamp: lastRecord.timestamp
        } : null,

        /**
         * 現在保持している変数のリスト
         * 画面下部などで「現在保持している認可コード」などを確認するために使用します。
         */
        contextValues
    };
};