import fs from 'fs';
import path from 'path';
import { SessionContext } from '$lib/server/session-context';
import type { PageServerLoad } from './$types';
import type { ApiDefinition } from '$lib/types';

/**
 * メインページのサーバーサイドロード関数
 * 外部の data フォルダから API 定義とプリセットを動的に読み込みます。
 */
export const load: PageServerLoad = async ({ locals }) => {
    const apiDir = path.resolve(process.cwd(), 'data/oauth/api');
    const apiCatalog: Record<string, ApiDefinition[]> = {};

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

    // APIカタログの構築
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

    return {
        apiCatalog,
        sessionContext: SessionContext.getAsNameValues(locals.simses),
        // 外部プリセットデータの読み込み
        serverPresets: loadExternalJson('data/oauth/server.json'),
        clientPresets: loadExternalJson('data/oauth/client.json'),
        staticPresets: loadExternalJson('data/oauth/static.json')
    };
};