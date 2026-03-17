import { browser } from '$app/environment';

/**
 * 単一テキスト選択コンポーネントの状態管理クラス (SelectTextState)
 * ユーザーが最後に選択した項目（URLやパラメータ名など）を記憶し、
 * ブラウザの再読み込み後もその選択を維持するための永続化ロジックを提供します。
 */
export class SelectTextState {
    #key: string; // localStorage 内でデータを特定するための内部キー
    static readonly DEFAULT_VALUE = '';

    /**
     * Svelte 5 $state:
     * UI（セレクトボックスなど）とバインドされるリアクティブな状態です。
     */
    value = $state<string>(SelectTextState.DEFAULT_VALUE);

    /**
     * @param key コンポーネントごとに一意となる識別キー
     */
    constructor(key: string) {
        // 他のステート管理クラス（SelectArray等）と重複しないようプレフィックスを付与
        const prefix = "SelectTextProps_";
        this.#key = prefix + key;

        if (browser) {
            // --- クライアントサイド（ブラウザ実行時） ---
            
            // 1. ローカルストレージから保存済みの選択状態を復元
            this.value = localStorage.getItem(this.#key) ?? SelectTextState.DEFAULT_VALUE;

            /**
             * 2. 自動保存ロジック ($effect.root):
             * コンポーネントのライフサイクルに関わらず、このクラスインスタンスが存在する間
             * this.value の変更を監視し、リアルタイムでストレージへ書き込みます。
             */
            $effect.root(() => {
                $effect(() => {
                    // 依存関係を明示し、変更を確実にキャッチする
                    const currentValue = this.value;
                    localStorage.setItem(this.#key, currentValue);
                });
            });
        } else {
            // --- サーバーサイド（SSR実行時） ---
            // サーバー環境では Web Storage API が存在しないため、安全にデフォルト値を返却します
            this.value = SelectTextState.DEFAULT_VALUE;
        }
    }
}