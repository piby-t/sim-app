import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';
import { loadExternalJson } from '$lib/server/util/file-loader';
import type { SelectArrayText2Props, NameValue } from '$lib/types';

/**
 * FIDO認証チャレンジページサーバーのロード関数。
 */
export const load: PageServerLoad = async ({ cookies, locals }) => {
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    /**
     * ✅ 修正ポイント:
     * JSONが { "list": [...] } という構造の場合、
     * 型指定は SelectArrayText2Props ではなく { list: SelectArrayText2Props[] } と記述するのが「真っ当」です。
     */
    const serverPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/server.json', { list: [] });
    const clientPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/client.json', { list: [] });
    const staticPresets = loadExternalJson<{ list: NameValue[] }>('data/oauth/static.json', { list: [] });

    return {
        ...getKeyData(),
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(simses),

        // これで .svelte 側では data.serverPresets.list としてアクセス可能になります
        serverPresets: serverPresets ?? { list: [] },
        clientPresets: clientPresets ?? { list: [] },
        staticPresets: staticPresets ?? { list: [] }
    };
};