import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
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
        serverPresets: loadExternalJson('data/oauth/server.json'),
        clientPresets: loadExternalJson('data/oauth/client.json'),
        scopePresets: loadExternalJson('data/oauth/scope.json'),
        staticPresets: loadExternalJson('data/oauth/static.json'),
        authUrlPresets: loadExternalJson('data/oauth/auth_url.json')
    };
};