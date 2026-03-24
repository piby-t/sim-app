import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import { ExecutorFactory } from '$lib/server/executor/ExecutorFactory';
import type { SimRes, SimReq, CredentialRecord } from '$lib/types';
import fs from 'fs';
import path from 'path';

/**
 * FIDO 認証実行 (Assertion) エンドポイント
 * 配布後も動作するよう、外部 data フォルダの SignCount を更新します。
 */
export const POST: RequestHandler = async ({ request, cookies, locals, fetch }) => {
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    // 画面から渡されたパラメータを取得
    const { method, url, headers, body, isUrlEncoded, keyFile, usedSignCount } = await request.json();

    const simReq: SimReq = { kind: "API", method, url, header: headers, body: body };
    const simHttp = new SimHttp(simReq);
    let simRes: SimRes;

    try {
        const executor = ExecutorFactory.create(fetch);
        const response = await executor.execute({ method, url, headers, body, isUrlEncoded });
        
        simRes = { kind: "FIDO", status: response.status, header: response.headers, body: response.body };

        // ✅ 認証成功(200系) かつ 鍵ファイルが指定されている場合に SignCount を更新
        if (response.status >= 200 && response.status < 300 && keyFile) {
            /**
             * 💡 修正ポイント: 配布後のパス解決
             * src/lib/data ではなく、実行ルート直下の data/fido/key を参照します。
             */
            const keyPath = path.join(process.cwd(), 'data', 'fido', 'key', keyFile);
            
            if (fs.existsSync(keyPath)) {
                try {
                    const record = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as CredentialRecord;
                    
                    // ロジック: 実際に送信した値 (usedSignCount) が 現在の値以上であれば更新保存
                    const currentCount = record.signCount || 0;
                    if (usedSignCount >= currentCount) {
                        record.signCount = usedSignCount;
                        record.lastUsedAt = Date.now();
                        
                        // JSON ファイルを上書き保存
                        fs.writeFileSync(keyPath, JSON.stringify(record, null, 2), 'utf-8');
                        console.log(`[SIGN-COUNT UPDATE] SUCCESS: ${keyFile} (${currentCount} -> ${usedSignCount})`);
                    }
                } catch (parseErr) {
                    console.error(`[SIGN-COUNT UPDATE] Failed to parse/write key file: ${keyFile}`, parseErr);
                }
            } else {
                console.warn(`[SIGN-COUNT UPDATE] Key file not found at: ${keyPath}`);
            }
        }
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        simRes = { kind: "FIDO", status: 500, header: [], body: `Execution Error: ${errorMessage}` };
    }

    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    return json({ success: true });
};