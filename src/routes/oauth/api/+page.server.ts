import fs from 'fs';
import path from 'path';
import { SessionContext } from '$lib/server/session-context';
import type { PageServerLoad } from './$types';
import type { ApiDefinition, SelectArrayText2Props, NameValue } from '$lib/types';
import { loadExternalJson } from '$lib/server/util/file-loader'; // ✅ 共通関数をインポート

/**
 * メインページのサーバーサイドロード関数
 * 外部の data フォルダから API 定義カタログとプリセットを動的に読み込みます。
 */
export const load: PageServerLoad = async ({ locals }) => {
    // 1. APIカタログの構築パス解決
    const apiDir = path.resolve(process.cwd(), 'data/oauth/api');
    const apiCatalog: Record<string, ApiDefinition[]> = {};

    // 2. ディレクトリを走査してカタログを作成
    if (fs.existsSync(apiDir)) {
        try {
            const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const filePath = path.join(apiDir, file);
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ApiDefinition;
                    const group = content.group || 'Others';
                    if (!apiCatalog[group]) apiCatalog[group] = [];
                    apiCatalog[group].push({ ...content, fileName: file });
                } catch (error) {
                    console.error(`[ERROR] Failed to parse API definition: ${file}`, error);
                }
            }
        } catch (dirError) {
            console.error(`[ERROR] Failed to read directory: ${apiDir}`, dirError);
        }
    }

    /**
     * 3. ✅ 修正ポイント: 共通関数を利用したプリセットの取得
     * 型エラー (2353) 回避のため、{ list: T[] } 構造を明示。
     * fallback を指定しているため、戻り値は非 null として扱えます。
     */
    const serverPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/server.json', { list: [] })!;
    const clientPresets = loadExternalJson<{ list: SelectArrayText2Props[] }>('data/oauth/client.json', { list: [] })!;
    const staticPresets = loadExternalJson<{ list: NameValue[] }>('data/oauth/static.json', { list: [] })!;

    return {
        apiCatalog,
        sessionContext: SessionContext.getAsNameValues(locals.simses),
        
        // --- 外部プリセットデータの提供 ---
        serverPresets,
        clientPresets,
        staticPresets
    };
};