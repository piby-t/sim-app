// src/routes/fido/key_gen/+page.server.ts
import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';

export const load: PageServerLoad = async ({ cookies, locals }) => {
    // セッションIDの取得
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const keyData = getKeyData();

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
        return { list: [] };
    };

    return {
        ...keyData,
        // UI側の初期選択用 (最新のファイル名)
        latestKey: keyData.keyFiles.length > 0 ? keyData.keyFiles[0] : '',
        apiCatalog: getApiCatalog(),
        sessionContext: SessionContext.getAsNameValues(simses),
        
        // 外部プリセットデータの読み込み
        serverPresets: loadExternalJson('data/oauth/server.json'),
        clientPresets: loadExternalJson('data/oauth/client.json'),
        staticPresets: loadExternalJson('data/oauth/static.json')
    };
};