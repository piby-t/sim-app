import type { PageServerLoad } from './$types';
import { loadExternalJson } from '$lib/server/util/file-loader'; // ✅ 共通関数をインポート
import type { SelectArrayText2Props, SelectArrayCheckProps, NameValue } from '$lib/types';

/**
 * 認可リクエスト生成ページサーバーのロード関数。
 * 共通の file-loader を使用して、外部 data フォルダから全プリセットを動的に読み込みます。
 */
export const load: PageServerLoad = async () => {
    /**
     * ✅ 修正ポイント: 
     * 5つの JSON すべてが { "list": [...] } という構造であることを型定義に反映。
     * fallback を指定しているため、戻り値は非 null ( { list: [] } 以上 ) として確定します。
     */
    const serverPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/server.json', { list: [] })!;
    const clientPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/client.json', { list: [] })!;
    const scopePresets = loadExternalJson<{ list: SelectArrayCheckProps[] }>('data/oauth/scope.json', { list: [] })!;
    const staticPresets = loadExternalJson<{ list: NameValue[] }>('data/oauth/static.json', { list: [] })!;
    const authUrlPresets = loadExternalJson<{ list: NameValue[] }>('data/oauth/auth_url.json', { list: [] })!;

    return {
        // --- 外部プリセットデータの提供 ---
        serverPresets,
        clientPresets,
        scopePresets,
        staticPresets,
        authUrlPresets
    };
};