import type { PageServerLoad } from './$types';
import { HistoryManager } from '$lib/server/history-manager';

/**
 * リクエスト確認画面用ロード関数
 * 外部（認可サーバー等）からこのアプリが呼び出された際の「受信内容」を
 * 履歴の中から特定し、表示用に抽出します。
 */
export const load: PageServerLoad = async ({ locals }) => {
    const simses = locals.simses;
    const history = HistoryManager.getHistory(simses);

    /**
     * 最新の「Display」レコードを特定:
     * kind: "Display" は、サーバーサイドのフック(hooks)等で
     * 外部からのリクエストを捕捉し、履歴に記録した際の識別子です。
     * これを新しい順に検索して、直近の受信内容を取得します。
     */
    const displayRecord = [...history].reverse().find(h => h.req.kind === "Display");

    return {
        // 直近で受信したリクエスト内容とその時の応答情報を返却
        lastReq: displayRecord?.req ?? undefined,
        lastRes: displayRecord?.res ?? undefined
    };
};