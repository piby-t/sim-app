import fs from 'fs';
import path from 'path';
import type { ApiDefinition, CredentialRecord } from '$lib/types';

const baseDir = process.cwd();
const API_DIR = path.resolve(baseDir, 'src/lib/data/fido/api');
const KEY_DIR = path.resolve(baseDir, 'src/lib/data/fido/key');

/**
 * FIDO APIカタログを読み込む (ディレクトリ・ファイル両対応)
 */
export function getApiCatalog(): Record<string, ApiDefinition[]> {
    const apiCatalog: Record<string, ApiDefinition[]> = {};
    if (!fs.existsSync(API_DIR)) return apiCatalog;

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
    if (!fs.existsSync(KEY_DIR)) return { keyFiles, keyContents };

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