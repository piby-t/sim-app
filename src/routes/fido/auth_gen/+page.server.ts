import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import type { ApiDefinition, CredentialRecord } from '$lib/types';
import fs from 'fs';
import path from 'path';

export const load: PageServerLoad = async ({ locals }) => {
    const simses = locals.simses;
    const baseDir = process.cwd();
    const apiDir = path.resolve(baseDir, 'src/lib/data/fido/api');
    const keyDir = path.resolve(baseDir, 'src/lib/data/fido/key');

    const apiCatalog: Record<string, ApiDefinition[]> = {};
    if (fs.existsSync(apiDir)) {
        const entries = fs.readdirSync(apiDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const groupPath = path.join(apiDir, entry.name);
                const files = fs.readdirSync(groupPath).filter(f => f.endsWith('.json'));
                for (const file of files) {
                    const content = JSON.parse(fs.readFileSync(path.join(groupPath, file), 'utf-8'));
                    const groupName = content.group || entry.name; 
                    if (!apiCatalog[groupName]) apiCatalog[groupName] = [];
                    apiCatalog[groupName].push({ ...content, fileName: file });
                }
            }
        }
    }

    const keyFiles: string[] = [];
    const keyContents: Record<string, CredentialRecord> = {}; // 👈 これを追加
    
    if (fs.existsSync(keyDir)) {
        const files = fs.readdirSync(keyDir).filter(f => f.endsWith('.json'));
        const sorted = files.sort((a, b) => 
            fs.statSync(path.join(keyDir, b)).mtime.getTime() - fs.statSync(path.join(keyDir, a)).mtime.getTime()
        );
        for (const file of sorted) {
            keyFiles.push(file);
            keyContents[file] = JSON.parse(fs.readFileSync(path.join(keyDir, file), 'utf-8'));
        }
    }

    return { 
        keyFiles, 
        keyContents, // 👈 これでページ側からアクセス可能になる
        apiCatalog, 
        sessionContext: SessionContext.getAsNameValues(simses) 
    };
};