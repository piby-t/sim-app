import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';
import { loadExternalJson } from '$lib/server/util/file-loader'; // ✅ 共通関数を使用
import type { SelectArrayText2Props, NameValue } from '$lib/types';

/**
 * FIDO認証生成ページサーバーのロード関数。
 * 外部の data/oauth フォルダからプリセットを動的に読み込みます。
 */
export const load: PageServerLoad = async ({ cookies, locals }) => {
    // 1. セッションコンテキストの特定
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    /**
     * ✅ 修正ポイント: 
     * ジェネリクスには「ファイル全体の構造」を指定します。
     * JSONが { "list": [...] } なので、<{ list: T[] }> の形式で指定するのが真っ当です。
     */
    const serverPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/server.json', { list: [] });
    const clientPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/client.json', { list: [] });
    const staticPresets = loadExternalJson<{ list: NameValue[] }>('data/oauth/static.json', { list: [] });

    return {
        // --- 既存の FIDO データ取得 (鍵データやAPIカタログ) ---
        ...getKeyData(),
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(simses),
        
        // --- 外部プリセットデータの提供 ---
        // null 合体演算子 (??) は loadExternalJson の fallback があるため基本不要ですが、
        // 型安全性をより盤石にするために記述しています。
        serverPresets: serverPresets ?? { list: [] },
        clientPresets: clientPresets ?? { list: [] },
        staticPresets: staticPresets ?? { list: [] }
    };
};