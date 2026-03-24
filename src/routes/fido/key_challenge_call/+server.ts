import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import { SessionContext } from '$lib/server/session-context';
import { ExecutorFactory } from '$lib/server/executor/ExecutorFactory';
import type { SimRes, SimReq, KeyMasterConfig } from '$lib/types';

import { generateAndSaveCredential } from '$lib/server/fido/fido-crypto';
import fs from 'fs';
import path from 'path';

/**
 * FIDO 登録 (Registration/Attestation) のオプション取得および鍵生成エンドポイント
 * 配布後も動作するよう、外部 data フォルダへ鍵情報を保存します。
 */
export const POST: RequestHandler = async ({ request, cookies, locals, fetch }) => {
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const { method, url, headers, body, isUrlEncoded } = await request.json();

    const simReq: SimReq = { kind: "API", method, url, header: headers, body: body };
    const simHttp = new SimHttp(simReq);
    let simRes: SimRes;

    try {
        const executor = ExecutorFactory.create(fetch);
        const response = await executor.execute({ method, url, headers, body, isUrlEncoded });

        simRes = { kind: "FIDO", status: response.status, header: response.headers, body: response.body };

        if (response.status >= 200 && response.status < 300) {
            try {
                const resJson = JSON.parse(response.body);
                const fidoData = resJson.publicKey || resJson;
                const userId = fidoData.user?.id || "unknown-user";
                const rpId = fidoData.rp?.id || "localhost";
                const challenge = fidoData.challenge || "";
                
                // セッションコンテキストの更新
                SessionContext.setValue(simses, 'challenge', challenge);
                SessionContext.setValue(simses, 'rpId', rpId);
                SessionContext.setValue(simses, 'userId', userId);
                SessionContext.setValue(simses, 'userName', fidoData.user?.name || "user-name");
                SessionContext.setValue(simses, 'displayName', fidoData.user?.displayName || "User Name");

                // 💡 修正ポイント: key_master.json を外部フォルダから動的に読み込む
                const configPath = path.resolve(process.cwd(), 'data/fido/key_master.json');
                let config: KeyMasterConfig;
                
                if (fs.existsSync(configPath)) {
                    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                } else {
                    throw new Error(`key_master.json not found at: ${configPath}`);
                }

                const userObj = {
                    id: userId,
                    name: fidoData.user?.name || "user-name",
                    displayName: fidoData.user?.displayName || "User Name"
                };
                
                // 楕円曲線暗号によるキーペア生成 (※内部の Crypto API を使用)
                const { record } = await generateAndSaveCredential(rpId, userObj, config);

                // 💡 修正ポイント: 保存先ディレクトリを外部の data/fido/key に変更
                const keyDir = path.resolve(process.cwd(), 'data/fido/key');
                console.log(`[FIDO REG] Saving key to: ${keyDir}`);

                if (!fs.existsSync(keyDir)) {
                    fs.mkdirSync(keyDir, { recursive: true });
                }

                // ファイル名のサニタイズと保存
                const safeFileName = String(userId).replace(/[\\/:*?"<>|]/g, '_');
                const filePath = path.join(keyDir, `${safeFileName}.json`);
                
                fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
                console.log(`[FIDO REG] SUCCESS: Key file created at ${filePath}`);

            } catch (err) {
                console.error("[FIDO REG] Response parsing / Key gen failed:", err);
            }
        }

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        simRes = { kind: "FIDO", status: 500, header: [], body: `Execution Error: ${msg}` };
    }

    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    return json({ success: true });
};