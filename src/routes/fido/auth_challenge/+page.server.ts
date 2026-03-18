import fs from 'fs';
import path from 'path';
import { SessionContext } from '$lib/server/session-context';
import type { PageServerLoad } from './$types';
import type { ApiDefinition, CredentialRecord } from '$lib/types';

export const load: PageServerLoad = async ({ cookies, locals }) => {
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const baseDir = process.cwd();
    const apiDir = path.resolve(baseDir, 'src/lib/data/fido/api');
    const keyDir = path.resolve(baseDir, 'src/lib/data/fido/key');

    // 1. APIカタログの読み込み
    const apiCatalog: Record<string, ApiDefinition[]> = {};
    if (fs.existsSync(apiDir)) {
        const entries = fs.readdirSync(apiDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const groupPath = path.join(apiDir, entry.name);
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
                    const content = JSON.parse(fs.readFileSync(path.join(apiDir, entry.name), 'utf-8')) as ApiDefinition;
                    const groupName = content.group || "General";
                    if (!apiCatalog[groupName]) apiCatalog[groupName] = [];
                    apiCatalog[groupName].push({ ...content, fileName: entry.name });
                } catch (e) { console.error(`Failed to parse API file: ${entry.name}`, e); }
            }
        }
    }

    // 2. 鍵データの読み込み
    const keyFiles: string[] = [];
    const keyContents: Record<string, CredentialRecord> = {};
    if (fs.existsSync(keyDir)) {
        const files = fs.readdirSync(keyDir).filter(f => f.endsWith('.json'));
        const sorted = files.sort((a, b) => 
            fs.statSync(path.join(keyDir, b)).mtime.getTime() - fs.statSync(path.join(keyDir, a)).mtime.getTime()
        );
        for (const file of sorted) {
            try {
                keyContents[file] = JSON.parse(fs.readFileSync(path.join(keyDir, file), 'utf-8')) as CredentialRecord;
                keyFiles.push(file);
            } catch (e) { console.error(`Failed to parse Key file: ${file}`, e); }
        }
    }

    return { apiCatalog, keyFiles, keyContents, sessionContext: SessionContext.getAsNameValues(simses) };
};