import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';
import { loadExternalJson } from '$lib/server/util/file-loader'; // ✅ 共通関数をインポート
import type { SelectArrayText2Props, NameValue } from '$lib/types';

/**
 * FIDO 鍵生成ページサーバーのロード関数。
 * 共通の file-loader を使用して外部データをポータブルに読み込みます。
 */
export const load: PageServerLoad = async ({ cookies, locals }) => {
    // 1. セッションIDと既存鍵データの取得
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const keyData = getKeyData();

    // 2. 共通関数を利用した外部データの取得
    // 型エラー (2353) を防ぐため、{ list: T[] } 構造を明示的に指定します。
    const serverPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/server.json', { list: [] })!;
    const clientPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/client.json', { list: [] })!;
    const staticPresets = loadExternalJson<{ list: NameValue[] }>('data/oauth/static.json', { list: [] })!;

    return {
        ...keyData,
        // UI側の初期選択用 (最新のファイル名)
        latestKey: keyData.keyFiles.length > 0 ? keyData.keyFiles[0] : '',
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(simses),
        
        // --- 外部プリセットデータの提供 ---
        serverPresets,
        clientPresets,
        staticPresets
    };
};