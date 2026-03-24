import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog } from '$lib/server/util/file-list';

/**
 * FIDO Challenge ページサーバーのロード関数。
 * 外部の data フォルダからプリセットを動的に読み込みます。
 */
export const load: PageServerLoad = async ({ locals }) => {
    // 外部 JSON 読み込み用ヘルパー
    const loadExternalJson = (relativeContextPath: string) => {
        const fullPath = path.resolve(process.cwd(), relativeContextPath);
        try {
            if (fs.existsSync(fullPath)) {
                return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            }
        } catch (e) {
            console.error(`[ERROR] Failed to load preset: ${fullPath}`, e);
        }
        return { list: [] }; // 失敗時のフォールバック
    };

    return {
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(locals.simses),
        
        // --- 外部プリセットデータの追加 ---
        serverPresets: loadExternalJson('data/oauth/server.json'),
        clientPresets: loadExternalJson('data/oauth/client.json'),
        staticPresets: loadExternalJson('data/oauth/static.json')
    };
};