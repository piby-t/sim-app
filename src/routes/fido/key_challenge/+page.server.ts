import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog } from '$lib/server/util/file-list';
import { loadExternalJson } from '$lib/server/util/file-loader'; 
import type { SelectArrayText2Props, NameValue } from '$lib/types';

/**
 * FIDO Challenge ページサーバーのロード関数。
 */
export const load: PageServerLoad = async ({ locals }) => {
    // セッション情報の取得
    const sessionValues = SessionContext.getAsNameValues(locals.simses);

    /**
     * ✅ 修正ポイント: 
     * fallback を指定しているため、戻り値は「null にならない型」として推論されます。
     * これにより、return 時の ?? 判定を排除し、コードをより真っ当でシンプルにします。
     */
    const serverPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/server.json', { list: [] })!;
    const clientPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/client.json', { list: [] })!;
    const staticPresets = loadExternalJson<{ list: NameValue[] }>('data/oauth/static.json', { list: [] })!;

    return {
        apiCatalog: getApiCatalog(),
        sessionContext: sessionValues,
        
        // --- 外部プリセットデータの提供 ---
        // loadExternalJson で fallback を保証しているため、そのまま渡して OK です
        serverPresets,
        clientPresets,
        staticPresets
    };
};