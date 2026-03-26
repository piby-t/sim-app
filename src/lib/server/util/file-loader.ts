import fs from 'fs';
import path from 'path';

/**
 * 外部JSONファイルを読み込む共通関数
 * @param relativePath プロジェクトルートからの相対パス
 * @param fallback 読み込み失敗時に返すデフォルト値 (省略時は null)
 */
export function loadExternalJson<T>(relativePath: string, fallback: T | null = null): T | null {
    // 実行ルート直下を基点にパスを解決
    const fullPath = path.resolve(process.cwd(), relativePath);
    
    try {
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            return JSON.parse(content) as T;
        }
        console.warn(`[WARN] File not found: ${fullPath}`);
    } catch (e) {
        console.error(`[ERROR] Failed to load JSON: ${fullPath}`, e);
    }
    
    // 失敗した場合は指定されたフォールバック値を返す
    return fallback;
}