import { HistoryManager } from '$lib/server/history-manager';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals }) => {
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const lastRecord = HistoryManager.getLastRecord(simses);
    const serializedRecord = lastRecord ? JSON.parse(JSON.stringify(lastRecord)) : null;

    let rpId = null;
    let challenge = null;
    let isSuccess = false;

    if (serializedRecord?.res?.status >= 200 && serializedRecord?.res?.status < 300) {
        const body = typeof serializedRecord.res.body === 'string' 
            ? JSON.parse(serializedRecord.res.body) 
            : serializedRecord.res.body;

        const fidoData = body.publicKey || body;
        
        rpId = fidoData.rpId || fidoData.rp?.id || cookies.get('fido_last_rp_id');
        challenge = fidoData.challenge || cookies.get('fido_last_challenge');
        
        // 認証フローでは userId が無いことが多いため、challenge があれば成功とする
        if (challenge) {
            isSuccess = true;
        }
    }

    return {
        record: serializedRecord,
        rpId: rpId || '---',
        challenge: challenge || '',
        isSuccess
    };
};