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
 * RPサーバーへのリクエスト送信と、成功時の SignCount 更新を行います。
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
            const keyPath = path.join(process.cwd(), 'src', 'lib', 'data', 'fido', 'key', keyFile);
            
            if (fs.existsSync(keyPath)) {
                const record = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as CredentialRecord;
                
                // ロジック: 実際に送信した値 (usedSignCount) が 現在の値以上であれば更新保存
                const currentCount = record.signCount || 0;
                if (usedSignCount >= currentCount) {
                    record.signCount = usedSignCount;
                    record.lastUsedAt = Date.now();
                    fs.writeFileSync(keyPath, JSON.stringify(record, null, 2), 'utf-8');
                    console.log(`[SIGN-COUNT UPDATE] ${keyFile}: ${currentCount} -> ${usedSignCount}`);
                }
            }
        }
    } catch (err: unknown) {
        // ✅ ESLint 対応: any を使わず unknown から安全にメッセージを抽出
        const errorMessage = err instanceof Error ? err.message : String(err);
        simRes = { kind: "FIDO", status: 500, header: [], body: `Execution Error: ${errorMessage}` };
    }

    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    return json({ success: true });
};