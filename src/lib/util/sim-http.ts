import type { SimReq, SimRes } from '$lib/types';

/**
 * 通信データ保持クラス (SimHttp)
 * 1回のリクエストとそれに対するレスポンスをセットにして管理します。
 * 実行履歴(HistoryManager)に保存されるデータの最小単位となります。
 */
export class SimHttp {
    // 通信が発生した日時
    public readonly timestamp: Date;
    // 送信されたリクエスト詳細
    public req: SimReq;
    // サーバーから返ってきたレスポンス詳細（通信完了前は undefined）
    public res: SimRes | undefined;

    /**
     * @param req 送信内容(SimReq)を渡してインスタンスを生成します。
     * 生成時に自動的にタイムスタンプが記録されます。
     */
    constructor(req: SimReq) {
        this.timestamp = new Date();
        this.req = req;
    }

    /**
     * レスポンスをセットする
     * 通信が完了したタイミングで呼び出し、リクエストとレスポンスを紐付けます。
     * @param res サーバーから返ってきたレスポンスデータ
     */
    public setResponse(res: SimRes): void {
        this.res = res;
    }

    /**
     * リクエスト内容を更新する
     * 実行直前にリクエスト内容が書き換えられた場合などに使用します。
     * @param req 更新後のリクエストデータ
     */
    public setRequest(req: SimReq): void {
        this.req = req;
    }
}