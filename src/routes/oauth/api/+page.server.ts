import fs from 'fs';
import path from 'path';
import { SessionContext } from '$lib/server/session-context';
import type { PageServerLoad } from './$types';
import type { NameValue, ApiDefinition } from '$lib/types';

/**
 * メインページのサーバーサイドロード関数
 * API定義ファイルの読み込みと、現在のセッション情報の取得を行います。
 */
export const load: PageServerLoad = async ({ locals }) => {
    // API定義ファイルが格納されているディレクトリパスの解決
    const apiDir = path.resolve('src/lib/data/oauth/api');
    
    // ディレクトリが存在しない場合のフォールバック処理
    if (!fs.existsSync(apiDir)) {
        return {
            apiCatalog: {} as Record<string, ApiDefinition[]>, 
            sessionContext: [] as NameValue[] 
        };
    }

    // ディレクトリ内の全JSONファイルを読み込み、グループごとにカタログ化
    const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.json'));
    const apiCatalog: Record<string, ApiDefinition[]> = {};

    for (const file of files) {
        try {
            const filePath = path.join(apiDir, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ApiDefinition;
            
            // 定義内の 'group' プロパティを使用してカタログを分類
            const group = content.group || 'Others';
            if (!apiCatalog[group]) apiCatalog[group] = [];
            
            // ファイル名も含めてカタログに追加
            apiCatalog[group].push({ ...content, fileName: file });
        } catch (error) {
            // 個別のファイル読み込みに失敗しても、他のファイルに影響させない
            console.error(`Failed to parse API definition: ${file}`, error);
        }
    }

    /**
     * クライアント側に返すデータ:
     * 1. apiCatalog: 画面左側のメニュー等で使用
     * 2. sessionContext: 前ステップで取得した code やトークンを初期値としてセット
     */
    return {
        apiCatalog,
        sessionContext: SessionContext.getAsNameValues(locals.simses)
    };
};