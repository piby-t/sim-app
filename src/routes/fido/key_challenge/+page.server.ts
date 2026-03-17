import fs from 'fs';
import path from 'path';
import { SessionContext } from '$lib/server/session-context';
import type { PageServerLoad } from './$types';
import type { ApiDefinition } from '$lib/types';

/**
 * FIDO Challenge取得リクエスト画面のロード関数
 * FIDO関連のAPI定義ファイルを読み込みます。
 */
export const load: PageServerLoad = async ({ locals }) => {
    // FIDO用API定義ディレクトリの解決
    // 開発機と配布環境の両方に対応できるよう process.cwd() を推奨しますが、
    // 現在のプロジェクト構成に合わせて src/lib/data/fido/api を参照します。
    const apiDir = path.resolve('src/lib/data/fido/api');
    
    const apiCatalog: Record<string, ApiDefinition[]> = {};

    if (fs.existsSync(apiDir)) {
        const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const filePath = path.join(apiDir, file);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ApiDefinition;
                
                const group = content.group || 'FIDO_Operations';
                if (!apiCatalog[group]) apiCatalog[group] = [];
                
                apiCatalog[group].push({ ...content, fileName: file });
            } catch (error) {
                console.error(`Failed to parse FIDO API definition: ${file}`, error);
            }
        }
    }

    return {
        apiCatalog,
        // OAuthと共通のセッションコンテキストを利用（取得した変数を再利用可能にするため）
        sessionContext: SessionContext.getAsNameValues(locals.simses)
    };
};