import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';

export const load: PageServerLoad = async ({ locals }) => {
    const keyData = getKeyData();
    
    return {
        ...keyData,
        // UI側の初期選択用 (最新のファイル名)
        latestKey: keyData.keyFiles.length > 0 ? keyData.keyFiles[0] : '',
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(locals.simses)
    };
};