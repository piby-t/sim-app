import { browser } from '$app/environment';

/**
 * チェックボックス付き配列選択コンポーネントの状態管理クラス
 * 画面上の選択状態を $state で保持しつつ、localStorage を通じてブラウザに永続化します。
 */
export class SelectArrayCheckState {
    #key: string; // localStorage 用のプライベートキー
    static readonly DEFAULT_VALUE = '';

    // Svelte 5 $state: UIと連動するリアクティブな選択値
    value = $state<string>(SelectArrayCheckState.DEFAULT_VALUE);

    /**
     * @param key ストレージ内で一意となる識別子
     */
    constructor(key: string) {
        // 他のコンポーネントの状態と衝突しないようプレフィックスを付与
        const prefix = "SelectArrayCheck_";
        this.#key = prefix + key;

        // ブラウザ環境（クライアントサイド）でのみ実行
        if (browser) {
            // 初期化：保存されている値があれば復元
            this.value = localStorage.getItem(this.#key) ?? SelectArrayCheckState.DEFAULT_VALUE;
            
            /**
             * 自動保存ロジック ($effect.root):
             * クラス内で $effect を使用するために root を作成。
             * this.value が書き換わるたびに、自動的に localStorage へ同期します。
             */
            $effect.root(() => {
                $effect(() => {
                    localStorage.setItem(this.#key, this.value);
                });
            });
        }
    }
}