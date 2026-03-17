import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import type { ApiDefinition } from '$lib/types';
import fs from 'fs';
import path from 'path';

/**
 * ページ読み込み時にサーバーサイドで実行されるロード関数
 * FIDO関連のAPI定義カタログと、保存されている鍵ファイルの一覧を取得し、
 * クライアント（画面側）に描画用の初期データとして渡します。
 */
export const load: PageServerLoad = async ({ locals }) => {
    // セッションIDの取得
    const simses = locals.simses;
    
    // 読み込み対象のディレクトリを絶対パスで安全に解決
    const baseDir = process.cwd();
    const apiDir = path.resolve(baseDir, 'src/lib/data/fido/api');
    const keyDir = path.resolve(baseDir, 'src/lib/data/fido/key');

    // クライアントへ返すAPIカタログの格納用オブジェクト
    const apiCatalog: Record<string, ApiDefinition[]> = {};

    // ============================================================================
    // 1. API定義ファイル群の読み込みとカタログ化
    // ============================================================================
    if (fs.existsSync(apiDir)) {
        // ディレクトリ内のファイルとサブディレクトリを一覧取得
        const entries = fs.readdirSync(apiDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                // サブディレクトリの場合は、その中のJSONファイルを読み込む
                const groupPath = path.join(apiDir, entry.name);
                const files = fs.readdirSync(groupPath).filter(f => f.endsWith('.json'));
                
                for (const file of files) {
                    const content = JSON.parse(fs.readFileSync(path.join(groupPath, file), 'utf-8'));
                    // JSON内に group 指定があればそれを優先し、なければディレクトリ名をグループ名とする
                    const groupName = content.group || entry.name; 
                    
                    if (!apiCatalog[groupName]) apiCatalog[groupName] = [];
                    apiCatalog[groupName].push({ ...content, fileName: file });
                }
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                // ルート直下に配置されたJSONファイルの場合
                const content = JSON.parse(fs.readFileSync(path.join(apiDir, entry.name), 'utf-8'));
                // グループ指定がない場合は "General" (一般) グループに分類
                const groupName = content.group || "General";
                
                if (!apiCatalog[groupName]) apiCatalog[groupName] = [];
                apiCatalog[groupName].push({ ...content, fileName: entry.name });
            }
        }
    }

    // ============================================================================
    // 2. 登録済み鍵ファイル（Credential）の読み込みと最新判定
    // ============================================================================
    let keyFiles: string[] = [];
    let latestKey = '';
    
    if (fs.existsSync(keyDir)) {
        // .json 拡張子のファイルのみを抽出
        const files = fs.readdirSync(keyDir).filter(f => f.endsWith('.json'));
        
        // ファイルの更新日時（mtime）の降順（新しい順）にソート
        // これにより、画面のセレクトボックスで最新の鍵が一番上に来るようにする
        keyFiles = files.sort((a, b) => 
            fs.statSync(path.join(keyDir, b)).mtime.getTime() - fs.statSync(path.join(keyDir, a)).mtime.getTime()
        );
        
        // 最も新しい鍵ファイルをデフォルト選択用に保持
        if (keyFiles.length > 0) latestKey = keyFiles[0];
    }

    // ============================================================================
    // 3. クライアントへのデータ返却
    // ============================================================================
    return { 
        keyFiles, 
        latestKey, 
        apiCatalog, 
        // 現在のセッション情報を NameValue 配列に変換して画面の変数一覧に渡す
        sessionContext: SessionContext.getAsNameValues(simses) 
    };
};