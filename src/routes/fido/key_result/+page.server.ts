import type { PageServerLoad } from './$types';
import { HistoryManager } from '$lib/server/history-manager';

export const load: PageServerLoad = async ({ cookies, locals }) => {
    // セッションIDの取得
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    // 履歴を取得し、最新の1件を抽出
    const history = HistoryManager.getHistory(simses);
    const latest = history.length > 0 ? history[history.length - 1] : null;

    return {
        // req と res を抽出してクライアントに渡す
        record: latest ? { req: latest.req, res: latest.res } : null
    };
};