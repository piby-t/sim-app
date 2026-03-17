import type { SimHttp } from '$lib/util/sim-http';

/**
 * シミュレーション実行履歴の管理オブジェクト
 * メモリ(Map)上でセッションごとのリクエスト・レスポンス履歴を保持します。
 */
const historyMap = new Map<string, SimHttp[]>();

export const HistoryManager = {
    /**
     * 指定されたセッションIDに紐づく履歴リストを取得します。
     * 存在しない場合は新しい空のリストを作成して返します。
     * @param simses セッション識別子
     */
    getHistory(simses: string): SimHttp[] {
        if (!historyMap.has(simses)) {
            historyMap.set(simses, []);
        }
        return historyMap.get(simses)!;
    },

    /**
     * すべてのセッションの履歴を統合して取得します。
     * 全体の時系列ログを表示する場合などに使用します。
     */
    getAllHistory(): SimHttp[] {
        const all: SimHttp[] = [];
        for (const records of historyMap.values()) {
            all.push(...records);
        }
        // メモリ上のデータが混在するため、必要に応じてタイムスタンプでのソートを検討してください
        return all;
    },

    /**
     * 新しい実行記録を追加します。
     * メモリ負荷を避けるため、1セッションあたり最大100件までの制限を設けています。
     * @param simses セッション識別子
     * @param record 記録する通信データ
     */
    addRecord(simses: string, record: SimHttp) {
        const history = this.getHistory(simses);
        history.push(record);

        // 古い履歴を削除するキュー処理（簡易的なメモリ管理）
        if (history.length > 100) {
            history.shift();
        }
    },

    /**
     * 指定されたセッションの最新の記録を取得します。
     * @param simses セッション識別子
     */
    getLastRecord(simses: string): SimHttp | undefined {
        const history = this.getHistory(simses);
        return history.length > 0 ? history[history.length - 1] : undefined;
    }
};