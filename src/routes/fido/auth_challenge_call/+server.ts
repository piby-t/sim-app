import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import { SessionContext } from '$lib/server/session-context';
import { ExecutorFactory } from '$lib/server/executor/ExecutorFactory';
import type { SimRes, SimReq } from '$lib/types';

export const POST: RequestHandler = async ({ request, cookies, locals, fetch }) => {
    // セッションIDの取得
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const { method, url, headers, body, isUrlEncoded } = await request.json();

    // 実行履歴(ダッシュボード)に記録するためのリクエストオブジェクトを生成
    const simReq: SimReq = { kind: "API", method, url, header: headers, body: body };
    const simHttp = new SimHttp(simReq);
    let simRes: SimRes;

    try {
        // SvelteKit標準の fetch を Executor に渡して通信実行
        const executor = ExecutorFactory.create(fetch);
        const response = await executor.execute({ method, url, headers, body, isUrlEncoded });

        simRes = { kind: "FIDO", status: response.status, header: response.headers, body: response.body };

        // RPサーバーからの通信が成功(2xx)した場合、レスポンス内のFIDOオプションを解析
        if (response.status >= 200 && response.status < 300) {
            try {
                const resJson = JSON.parse(response.body);
                console.log("[DEBUG] Auth RP Response Body:", resJson);

                // 認証(Assertion)時のオプション構造(publicKey)を考慮してデータを抽出
                const fidoData = resJson.publicKey || resJson;
                
                const challenge = fidoData.challenge || "";
                const rpId = fidoData.rpId || fidoData.rp?.id || "localhost";
                
                // 認証フローでも Identifier-First などで User情報が返る場合を考慮
                const userId = fidoData.user?.id || "unknown-user";
                const userName = fidoData.user?.name || "user-name";

                console.log(`[DEBUG] Auth Extracted -> rpId: ${rpId}, challenge(len): ${challenge.length}`);

                // 後続の署名生成などで使用するため、必須パラメータをセッションコンテキストに保存
                SessionContext.setValue(simses, 'challenge', challenge);
                SessionContext.setValue(simses, 'rpId', rpId);
                
                // UI表示や後続(Identifier-Firstの場合)のために念のため保存
                if (userId !== "unknown-user") SessionContext.setValue(simses, 'userId', userId);
                if (userName !== "user-name") SessionContext.setValue(simses, 'userName', userName);

                // ★ allowCredentials (要求された鍵リスト) はシミュレータの柔軟性のため破棄し、手動選択に委ねる
                // ★ Authでは仮想Authenticatorによる「鍵作成処理」は行いません。

            } catch (err) {
                console.error("[ERROR] Auth Response parsing failed:", err);
            }
        }

    } catch (err: unknown) {
        // 通信レベルでのエラーや、Executor内部での致命的なエラーを捕捉
        const msg = err instanceof Error ? err.message : String(err);
        simRes = { kind: "FIDO", status: 500, header: [], body: `Execution Error: ${msg}` };
    }

    // 通信結果を履歴マネージャーに記録
    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    return json({ success: true });
};