import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import { SessionContext } from '$lib/server/session-context';
import { ExecutorFactory } from '$lib/server/executor/ExecutorFactory';
import type { SimRes, SimReq } from '$lib/types';

/**
 * 【FIDO 認証オプション取得 API プロキシ】
 * クライアント画面からの要求を受け取り、実際のリモート RP サーバーへリクエストを飛ばします。
 * 取得したチャレンジや RP ID をセッションに保存し、次工程の「署名生成」へ繋げます。
 */
export const POST: RequestHandler = async ({ request, cookies, locals, fetch }) => {
    // 1. セッションコンテキストの特定
    // 複数のテストを並行して行えるよう、cookie または locals からシミュレータ用セッションIDを取得
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    // クライアント(Svelte画面)で組み立てられたリクエスト内容をパース
    const { method, url, headers, body, isUrlEncoded } = await request.json();

    // 2. 実行履歴記録用の準備
    // シミュレータのダッシュボードで「どのような電文を送ったか」を確認可能にするため SimHttp インスタンスを生成
    const simReq: SimReq = { kind: "API", method, url, header: headers, body: body };
    const simHttp = new SimHttp(simReq);
    let simRes: SimRes;

    try {
        // 3. 外部 RP サーバーへの通信実行
        // ExecutorFactory を介して、認証、プロキシ設定、ログ記録を考慮した通信を実行
        const executor = ExecutorFactory.create(fetch);
        const response = await executor.execute({ method, url, headers, body, isUrlEncoded });

        // レスポンスの構築（履歴保存用）
        simRes = { kind: "FIDO", status: response.status, header: response.headers, body: response.body };

        // 4. FIDO 認証オプション (Assertion Options) の解析
        // ステータスコードが成功(2xx)の場合のみ、レスポンスボディから WebAuthn 用のデータを取り出す
        if (response.status >= 200 && response.status < 300) {
            try {
                const resJson = JSON.parse(response.body);
                console.log("[DEBUG] Auth RP Response Body:", resJson);

                /**
                 * FIDO 仕様に基づいたデータの抽出
                 * 多くの RP サーバーは WebAuthn 仕様通りの `publicKey` オブジェクトを返しますが、
                 * サーバーの実装によっては直下に challenge 等がある場合も考慮します。
                 */
                const fidoData = resJson.publicKey || resJson;
                
                // --- Challenge ---
                // サーバーが生成したランダム値。リプレイ攻撃防止のため、後の署名対象に含まれる。
                const challenge = fidoData.challenge || "";
                
                // --- RP ID ---
                // 認証を要求しているドメイン。ブラウザ/認証器はこの値が自身のオリジンと一致するか検証する。
                const rpId = fidoData.rpId || fidoData.rp?.id || "localhost";
                
                // --- User Info ---
                // Assertion(認証)時は通常不要だが、Identifier-First（ID入力後認証）の場合は
                // サーバーから User ID や Display Name が返ってくることがあるため取得しておく。
                const userId = fidoData.user?.id || "unknown-user";
                const userName = fidoData.user?.name || "user-name";

                console.log(`[DEBUG] Auth Extracted -> rpId: ${rpId}, challenge(len): ${challenge.length}`);

                /**
                 * 5. セッションコンテキストへの永続化
                 * ここで保存した値が、次画面の「Auth Verification (署名生成)」で
                 * デフォルトの `Session Context` として自動ロードされます。
                 */
                SessionContext.setValue(simses, 'challenge', challenge);
                SessionContext.setValue(simses, 'rpId', rpId);
                
                // ユーザー情報が取得できた場合は、それも保存（画面表示やログに使用）
                if (userId !== "unknown-user") SessionContext.setValue(simses, 'userId', userId);
                if (userName !== "user-name") SessionContext.setValue(simses, 'userName', userName);

                /**
                 * 【シミュレータ特有の設計方針】
                 * サーバーは通常 `allowCredentials` (この鍵で署名してほしいリスト) を返しますが、
                 * シミュレータでは「あえて別の鍵で署名してエラーを出すテスト」等も行えるよう、
                 * リストは固定せず、ユーザーが画面上で自由に鍵ファイルを選択する設計にしています。
                 */

            } catch (err) {
                console.error("[ERROR] Auth Response parsing failed:", err);
            }
        }

    } catch (err: unknown) {
        // ネットワーク切断やタイムアウトなど、HTTP通信自体が失敗した場合のハンドリング
        const msg = err instanceof Error ? err.message : String(err);
        simRes = { kind: "FIDO", status: 500, header: [], body: `Execution Error: ${msg}` };
    }

    // 6. 履歴への最終記録
    // リクエストとレスポンスを紐付けて、HistoryManager (ファイルまたはメモリ) に保存
    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    // フロントエンドには単純な成功を返す（データはセッション経由で共有されるため）
    return json({ success: true });
};