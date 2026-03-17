import { redirect, type RequestHandler } from '@sveltejs/kit';
import { HistoryManager } from '$lib/server/history-manager';
import { SessionContext } from '$lib/server/session-context';

/**
 * 認可レスポンス（コールバック）ハンドラ
 * 認可サーバーからのリダイレクトを受け取り、認可コード(code)の抽出と
 * CSRF対策の state 検証を行います。
 */
export const GET: RequestHandler = async ({ url, locals }) => {
    // 1. クエリパラメータから code と state を抽出
    const code = url.searchParams.get('code');
    const reqState = url.searchParams.get('state');

    // 2. 直前の履歴（認可リクエスト送信時）を参照して state 検証を行う
    const lastRecord = HistoryManager.getLastRecord(locals.simses);

    if (lastRecord && lastRecord.req.kind === 'Authorization') {
        let originalState: string | null = null;
        
        /**
         * 保存されていたリクエスト時のURLから送信した state を取得
         * 変数置換前のRaw URLが含まれる可能性があるため、パースを工夫しています。
         */
        try {
            const reqUrl = new URL(lastRecord.req.url);
            originalState = reqUrl.searchParams.get('state');
        } catch {
            // URLとして不正な場合（テンプレート文字が残っている場合等）のフォールバック
            const queryString = lastRecord.req.url.split('?')[1];
            const params = new URLSearchParams(queryString);
            originalState = params.get('state');
        }

        // 送信時と受信時の state が一致するか検証
        const isStateValid = originalState === reqState;

        // 検証結果を含めて履歴のレスポンス情報を上書き保存
        lastRecord.setResponse({
            kind: "Authorization",
            url: url.toString(),
            stateValid: isStateValid
        });
    }

    /**
     * 3. 認可コードの自動保存
     * 取得した code をセッションコンテキストに保存し、
     * 次の「トークン要求」ステップで自動利用できるようにします。
     */
    if (code) {
        SessionContext.setValue(locals.simses, 'code', code);
    }

    /**
     * 4. 結果表示ページへリダイレクト
     * サーバーサイドの処理が終わったため、ユーザーに見せるための画面へ遷移させます。
     */
    throw redirect(302, '/oauth/callbackresult');
};