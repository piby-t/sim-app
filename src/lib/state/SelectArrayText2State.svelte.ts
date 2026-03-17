import { browser } from '$app/environment';

/**
 * テキスト配列選択コンポーネントの状態管理クラス (SelectArrayText2State)
 * サーバーサイドレンダリング(SSR)時のエラーを回避しつつ、
 * ブラウザ上でのユーザーの選択状態を localStorage に永続化します。
 */
export class SelectArrayText2State {
    #key: string; // localStorage 用の識別キー
    static readonly DEFAULT_VALUE = '';

    // Svelte 5 $state: UIと連動するリアクティブな状態定義
    // 定義自体はサーバー/クライアント両方で有効です
    value = $state<string>(SelectArrayText2State.DEFAULT_VALUE);

    /**
     * @param key ストレージ内で一意となる識別子
     */
    constructor(key: string) {
        const prefix = "SelectArrayText2Props_";
        this.#key = prefix + key;

        if (browser) {
            // --- クライアントサイド（ブラウザ）専用の処理 ---
            
            // 1. ローカルストレージから前回の値を復元
            this.value = localStorage.getItem(this.#key) ?? SelectArrayText2State.DEFAULT_VALUE;

            /**
             * 2. 自動保存ロジック ($effect.root):
             * クラスインスタンスの生存期間中、値の変化を監視し続けます。
             */
            $effect.root(() => {
                $effect(() => {
                    // this.value を参照することで、この effect が値の変更に反応するようにします
                    const currentValue = this.value; 
                    localStorage.setItem(this.#key, currentValue);
                });
            });
        } else {
            // --- サーバーサイド(SSR)専用の処理 ---
            // サーバー側には localStorage が存在しないため、安全にデフォルト値をセットします
            this.value = SelectArrayText2State.DEFAULT_VALUE;
        }
    }
}