import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import { SessionContext } from '$lib/server/session-context';
import { ExecutorFactory } from '$lib/server/executor/ExecutorFactory';
import type { SimRes, SimReq, KeyMasterConfig } from '$lib/types';

import { generateAndSaveCredential } from '$lib/server/fido/fido-crypto';
import keyMaster from '$lib/data/fido/key_master.json';

import fs from 'fs';
import path from 'path';

/**
 * FIDO 登録 (Registration/Attestation) のオプション取得および鍵生成エンドポイント
 * * 【処理フロー】
 * 1. RP (Relying Party) サーバーへリクエストを送信し、登録用オプション(チャレンジ等)を取得します。
 * 2. 取得したオプションをセッションに保持します。
 * 3. 仮想のAuthenticatorとして振る舞い、公開鍵/秘密鍵のペア(Credential)を生成します。
 * 4. 生成した鍵情報をローカルのJSONファイルとして保存します。
 */
export const POST: RequestHandler = async ({ request, cookies, locals, fetch }) => {
    // セッションIDの取得 (locals を優先し、無ければ Cookie から取得)
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const { method, url, headers, body, isUrlEncoded } = await request.json();

    // 実行履歴(ダッシュボード)に記録するためのリクエストオブジェクトを生成
    const simReq: SimReq = { kind: "API", method, url, header: headers, body: body };
    const simHttp = new SimHttp(simReq);
    let simRes: SimRes;

    try {
        // SvelteKit標準の `fetch` を Executor に渡すことで、
        // SSR時の相対パス解決や社内プロキシ(Zscaler等)の制限突破を可能にします。
        const executor = ExecutorFactory.create(fetch);
        const response = await executor.execute({ method, url, headers, body, isUrlEncoded });

        simRes = { kind: "FIDO", status: response.status, header: response.headers, body: response.body };

        // RPサーバーからの通信が成功(2xx)した場合、レスポンス内のFIDOオプションを解析
        if (response.status >= 200 && response.status < 300) {
            try {
                const resJson = JSON.parse(response.body);
                console.log("[DEBUG] RP Response Body:", resJson);

                // RPの実装によってラップされている場合(publicKey等)を考慮してデータを抽出
                const fidoData = resJson.publicKey || resJson;
                const userId = fidoData.user?.id || "unknown-user";
                const rpId = fidoData.rp?.id || "localhost";
                const challenge = fidoData.challenge || "";
                
                console.log(`[DEBUG] Extracted -> userId: ${userId}, rpId: ${rpId}`);

                // 後続の署名生成などで使用するため、必須パラメータをセッションコンテキストに保存
                SessionContext.setValue(simses, 'challenge', challenge);
                SessionContext.setValue(simses, 'rpId', rpId);
                SessionContext.setValue(simses, 'userId', userId);
                SessionContext.setValue(simses, 'userName', fidoData.user?.name || "user-name");
                SessionContext.setValue(simses, 'displayName', fidoData.user?.displayName || "User Name");

                // ============================================================================
                // 仮想Authenticatorによる鍵情報(Credential)の生成と保存
                // ============================================================================
                const config = keyMaster as KeyMasterConfig;
                const userObj = {
                    id: userId,
                    name: fidoData.user?.name || "user-name",
                    displayName: fidoData.user?.displayName || "User Name"
                };
                
                // 楕円曲線暗号(ECDSA P-256)によるキーペアを生成
                const { record } = await generateAndSaveCredential(rpId, userObj, config);

                // 保存先ディレクトリの解決と作成
                const keyDir = path.join(process.cwd(), 'src', 'lib', 'data', 'fido', 'key');
                console.log(`[DEBUG] Target Directory: ${keyDir}`);

                if (!fs.existsSync(keyDir)) {
                    fs.mkdirSync(keyDir, { recursive: true });
                }

                // ファイル名に不正な文字が含まれないようサニタイズして保存
                const safeFileName = String(userId).replace(/[\\/:*?"<>|]/g, '_');
                const filePath = path.join(keyDir, `${safeFileName}.json`);
                
                fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
                console.log(`[SUCCESS] File created at: ${filePath}`);

            } catch (err) {
                console.error("[ERROR] Response parsing / Key gen failed:", err);
            }
        }

    } catch (err: unknown) {
        // 通信レベルでのエラーや、Executor内部での致命的なエラーを捕捉
        const msg = err instanceof Error ? err.message : String(err);
        simRes = { kind: "FIDO", status: 500, header: [], body: `Execution Error: ${msg}` };
    }

    // 通信結果を履歴マネージャーに記録（画面の通信履歴ダッシュボードに表示される）
    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    return json({ success: true });
};