import { HistoryManager } from '$lib/server/history-manager';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
    // セッションIDを取得 (クッキーから)
    const simses = cookies.get('simses') || 'default-session';
    
    // HistoryManager から直近の実行履歴を取得
    const lastRecord = HistoryManager.getLastRecord(simses);
    
    // SvelteKitのサーバーロード関数で返却するためシリアライズ
    const serializedRecord = lastRecord ? JSON.parse(JSON.stringify(lastRecord)) : null;

    let isSuccess = false;

    // 通信が成功(200系)しているかチェック
    if (serializedRecord?.res?.status >= 200 && serializedRecord?.res?.status < 300) {
        isSuccess = true;
    }

    // auth_result/+page.svelte 側にレコードと成功フラグを渡す
    return {
        record: serializedRecord,
        isSuccess
    };
};