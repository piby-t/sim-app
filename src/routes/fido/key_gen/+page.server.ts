import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
// ✅ 修正: types.ts から CredentialRecord をインポート
import type { ApiDefinition, CredentialRecord } from '$lib/types';
import fs from 'fs';
import path from 'path';

export const load: PageServerLoad = async ({ locals }) => {
    // app.d.ts が直っていれば、ここもそのまま受け取れます
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
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                const content = JSON.parse(fs.readFileSync(path.join(apiDir, entry.name), 'utf-8'));
                const groupName = content.group || "General";
                
                if (!apiCatalog[groupName]) apiCatalog[groupName] = [];
                apiCatalog[groupName].push({ ...content, fileName: entry.name });
            }
        }
    }

    let keyFiles: string[] = [];
    
    // ✅ 修正: types.ts の CredentialRecord を指定。これで完璧な型安全になります。
    const keyContents: Record<string, CredentialRecord> = {};
    let latestKey = '';
    
    if (fs.existsSync(keyDir)) {
        const files = fs.readdirSync(keyDir).filter(f => f.endsWith('.json'));
        keyFiles = files.sort((a, b) => 
            fs.statSync(path.join(keyDir, b)).mtime.getTime() - fs.statSync(path.join(keyDir, a)).mtime.getTime()
        );
        for (const f of keyFiles) {
            keyContents[f] = JSON.parse(fs.readFileSync(path.join(keyDir, f), 'utf-8'));
        }
        if (keyFiles.length > 0) latestKey = keyFiles[0];
    }

    return { 
        keyFiles, 
        keyContents, 
        latestKey, 
        apiCatalog, 
        sessionContext: SessionContext.getAsNameValues(simses) 
    };
};