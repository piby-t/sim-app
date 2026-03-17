import fs from 'fs';
import path from 'path';
import { SessionContext } from '$lib/server/session-context';
import type { PageServerLoad } from './$types';
import type { ApiDefinition } from '$lib/types';

export const load: PageServerLoad = async ({ cookies, locals }) => {
    // ✅ 修正: 複雑な型キャスト(ISession)を完全削除し、純粋なセッションID(文字列)として取得
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
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
        // ✅ 修正: 文字列(simses)をそのまま渡すだけでOK
        sessionContext: SessionContext.getAsNameValues(simses)
    };
};