import { redirect, type RequestHandler } from '@sveltejs/kit';
import { HistoryManager } from '$lib/server/history-manager';
import { SimHttp } from '$lib/util/sim-http';

/**
 * 認可リクエスト実行（リダイレクト）ハンドラ
 * 組み立てられたURLを履歴に保存したあと、認可サーバーへユーザーをリダイレクトさせます。
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    const formData = await request.formData();
    // 置換前の変数が見える状態のURL (人間用)
    const rawUrl = formData.get('rawUrl') as string;      
    // 実際にブラウザがアクセスするエンコード済みのURL (実行用)
    const encodedUrl = formData.get('encodedUrl') as string; 

    if (!encodedUrl) {
        return new Response('Encoded URL is required', { status: 400 });
    }

    /**
     * 1. 履歴保存用リクエストデータの作成
     * url プロパティに rawUrl を保存することで、
     * 履歴画面でどの変数がどう置換されたかを確認しやすくします。
     */
    const reqData = {
        kind: "Authorization" as const,
        url: rawUrl || encodedUrl 
    };

    /**
     * 2. 通信記録 (SimHttp) インスタンスの生成
     */
    const record = new SimHttp(reqData);

    /**
     * 3. レスポンス情報のセット
     * 認可リクエストは「送信＝成功」として記録するため、
     * ここでダミーのレスポンス情報をセットして完結させます。
     */
    record.setResponse({
        kind: "Authorization",
        url: rawUrl || encodedUrl,
        stateValid: true 
    });

    /**
     * 4. 履歴マネージャーへの登録
     * locals.simses（セッションID）を使用して、ユーザーごとの履歴に保存します。
     */
    HistoryManager.addRecord(locals.simses, record);

    console.log(`[History] Authorization Request recorded. Session: ${locals.simses}`);

    /**
     * 5. 認可サーバーへのリダイレクト実行
     * SvelteKitの redirect を使い、302レスポンスを返します。
     */
    throw redirect(302, encodedUrl);
};