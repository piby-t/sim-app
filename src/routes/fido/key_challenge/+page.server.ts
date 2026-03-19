import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog } from '$lib/server/util/file-list';

export const load: PageServerLoad = async ({ locals }) => {
    return {
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(locals.simses)
    };
};