import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';

/**
 * FIDO認証チャレンジページサーバーのロード関数。
 * 外部の data フォルダからプリセット設定を動的に読み込みます。
 */
export const load: PageServerLoad = async ({ cookies, locals }) => {
    // 1. セッションコンテキストの特定
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    // 2. 外部 JSON 読み込み用ヘルパー
    // 実行時のルート (process.cwd) を基点に data フォルダを参照
    const loadExternalJson = (relativeContextPath: string) => {
        const fullPath = path.resolve(process.cwd(), relativeContextPath);
        try {
            if (fs.existsSync(fullPath)) {
                return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            }
        } catch (e) {
            console.error(`[ERROR] Failed to load preset: ${fullPath}`, e);
        }
        return { list: [] }; // 読み込めない場合のフォールバック
    };

    return {
        // --- 既存の FIDO データ取得 ---
        ...getKeyData(),
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(simses),

        // --- ✨ 追加：外部プリセットデータの読み込み ---
        // 配布パッケージの data/oauth/ 直下のファイルを読み込む
        serverPresets: loadExternalJson('data/oauth/server.json'),
        clientPresets: loadExternalJson('data/oauth/client.json'),
        staticPresets: loadExternalJson('data/oauth/static.json')
    };
};