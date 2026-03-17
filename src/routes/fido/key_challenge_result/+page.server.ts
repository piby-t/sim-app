import { HistoryManager } from '$lib/server/history-manager';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
    const simses = cookies.get('simses') || 'default-session';
    const lastRecord = HistoryManager.getLastRecord(simses);
    const serializedRecord = lastRecord ? JSON.parse(JSON.stringify(lastRecord)) : null;

    let userId = null;
    let rpId = null;
    let challenge = null;
    let isSuccess = false;

    // 1. 通信が成功(200系)しているかチェック
    if (serializedRecord?.res?.status >= 200 && serializedRecord?.res?.status < 300) {
        const body = typeof serializedRecord.res.body === 'string' 
            ? JSON.parse(serializedRecord.res.body) 
            : serializedRecord.res.body;

        // ボディからデータを抽出
        userId = body.user?.id || body.userId || cookies.get('fido_last_user_id');
        rpId = body.rp?.id || body.rpId || cookies.get('fido_last_rp_id');
        challenge = body.challenge || cookies.get('fido_last_challenge');
        
        // 必須項目があれば成功とみなす
        if (userId && challenge) {
            isSuccess = true;
        }
    }

    return {
        record: serializedRecord,
        userId: userId || 'unknown-user',
        rpId: rpId || '---',
        challenge: challenge || '',
        isSuccess // 成功フラグを渡す
    };
};