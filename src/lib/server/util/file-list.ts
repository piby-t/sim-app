import fs from 'fs';
import path from 'path';
import type { ApiDefinition, CredentialRecord } from '$lib/types';

/**
 * 実行時のカレントディレクトリを基点にする
 * 開発時はプロジェクトルート、配布後はパッケージルートを指します。
 */
const baseDir = process.cwd();

// パスを src/lib/data から プロジェクト直下の data/ へ変更
const DATA_ROOT = path.resolve(baseDir, 'data');
const API_DIR = path.resolve(DATA_ROOT, 'fido/api');
const KEY_DIR = path.resolve(DATA_ROOT, 'fido/key');

/**
 * FIDO APIカタログを読み込む (ディレクトリ・ファイル両対応)
 */
export function getApiCatalog(): Record<string, ApiDefinition[]> {
    const apiCatalog: Record<string, ApiDefinition[]> = {};
    
    // フォルダが存在しない場合はログを出して空で返す
    if (!fs.existsSync(API_DIR)) {
        console.warn(`[WARN] API directory not found: ${API_DIR}`);
        return apiCatalog;
    }

    const entries = fs.readdirSync(API_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const groupPath = path.join(API_DIR, entry.name);
            const files = fs.readdirSync(groupPath).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(groupPath, file), 'utf-8')) as ApiDefinition;
                    const groupName = content.group || entry.name;
                    if (!apiCatalog[groupName]) apiCatalog[groupName] = [];
                    apiCatalog[groupName].push({ ...content, fileName: file });
                } catch (e) { console.error(`Failed to parse API file: ${file}`, e); }
            }
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(API_DIR, entry.name), 'utf-8')) as ApiDefinition;
                const groupName = content.group || "General";
                if (!apiCatalog[groupName]) apiCatalog[groupName] = [];
                apiCatalog[groupName].push({ ...content, fileName: entry.name });
            } catch (e) { console.error(`Failed to parse API file: ${entry.name}`, e); }
        }
    }
    return apiCatalog;
}

/**
 * 保存済みの鍵データを読み込む (更新日時順)
 */
export function getKeyData() {
    const keyFiles: string[] = [];
    const keyContents: Record<string, CredentialRecord> = {};

    // 鍵保存フォルダが存在しない場合は作成を試みる（配布直後の初回実行対策）
    if (!fs.existsSync(KEY_DIR)) {
        try {
            fs.mkdirSync(KEY_DIR, { recursive: true });
            console.log(`[INFO] Created Key directory: ${KEY_DIR}`);
        } catch (e) {
            console.error(`[ERROR] Failed to create Key directory: ${KEY_DIR}`, e);
            return { keyFiles, keyContents };
        }
    }

    const files = fs.readdirSync(KEY_DIR).filter(f => f.endsWith('.json'));
    
    // 更新日時順にソート (最新が先頭)
    const sorted = files.sort((a, b) =>
        fs.statSync(path.join(KEY_DIR, b)).mtime.getTime() - fs.statSync(path.join(KEY_DIR, a)).mtime.getTime()
    );

    for (const file of sorted) {
        try {
            keyContents[file] = JSON.parse(fs.readFileSync(path.join(KEY_DIR, file), 'utf-8')) as CredentialRecord;
            keyFiles.push(file);
        } catch (e) { console.error(`Failed to parse Key file: ${file}`, e); }
    }
    return { keyFiles, keyContents };
}