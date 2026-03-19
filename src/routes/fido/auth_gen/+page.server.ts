import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';

export const load: PageServerLoad = async ({ cookies, locals }) => {
    // SessionContext の取得 (locals または cookies から)
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    return {
        ...getKeyData(),
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(simses)
    };
};