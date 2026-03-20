<script lang="ts">
  /**
   * @file ApiCatalogSelector.svelte
   * @description FIDOのAPI定義(JSON)をグループ化して選択するための共通セレクトボックスコンポーネント。
   * Svelte 5 の Runes 機能を活用し、型安全な双方向バインディングを提供します。
   */
  import type { ApiDefinition } from "$lib/types";

  /**
   * コンポーネントのプロパティ定義
   * @interface Props
   * @property {Record<string, ApiDefinition[]>} apiCatalog - 読み込まれたAPIのリスト。キーがグループ名。
   * @property {ApiDefinition | null} selectedApi - 現在選択されているAPIオブジェクト（呼び出し元と双方向同期）。
   * @property {string} [className] - select要素に適用するCSSクラス。
   */
  let {
    apiCatalog = {},
    selectedApi = $bindable(),
    className = "form-select form-select-sm shadow-sm",
  } = $props<{
    apiCatalog: Record<string, ApiDefinition[]>;
    selectedApi: ApiDefinition | null;
    className?: string;
  }>();

  /**
   * 現在選択されているAPIを <select> の value (文字列) に変換するための導出状態。
   * selectedApi オブジェクトが変更された際に自動的に再計算されます。
   * 形式: "グループ名|ファイル名" (例: "FIDO|challenge.json")
   */
  const selectedValue = $derived.by(() => {
    if (!selectedApi) return "";

    // Object.entries の戻り値はデフォルトで unknown になりやすいため、明示的にキャストして型安全にループ
    const entries = Object.entries(apiCatalog) as [string, ApiDefinition[]][];

    for (const [group, list] of entries) {
      // 選択中のAPIの fileName と一致するものがこのグループ内にあるか判定
      if (
        list.some((a: ApiDefinition) => a.fileName === selectedApi?.fileName)
      ) {
        return `${group}|${selectedApi.fileName}`;
      }
    }
    return "";
  });

  /**
   * セレクトボックスの選択変更イベントハンドラ
   * 選択された文字列から該当する API オブジェクトを特定し、selectedApi を更新します。
   */
  function handleChange(e: Event & { currentTarget: HTMLSelectElement }) {
    const val = e.currentTarget.value;

    // 未選択 ("") が選ばれた場合
    if (!val) {
      selectedApi = null;
      return;
    }

    // value に埋め込んだ "グループ名|ファイル名" を分割
    const [group, fileName] = val.split("|");

    // グループが存在するか確認し、その中から fileName が一致する定義を検索
    const targetGroup = apiCatalog[group];
    if (targetGroup) {
      // find 結果を selectedApi に代入 ($bindable により呼び出し元のステートも更新される)
      selectedApi =
        targetGroup.find((a: ApiDefinition) => a.fileName === fileName) || null;
    }
  }
</script>

<select class={className} value={selectedValue} onchange={handleChange}>
  <option value="">APIを選択してください...</option>

  {#each Object.entries(apiCatalog) as [group, list] (group)}
    <optgroup label={group}>
      {#each list as ApiDefinition[] as api (api.fileName)}
        <option value="{group}|{api.fileName}">
          {api.display || api.fileName}
        </option>
      {/each}
    </optgroup>
  {:else}
    <option disabled>カタログが空です</option>
  {/each}
</select>

<style>
  /* 必要に応じてスタイルを追加（現在は外部クラスに依存） */
</style>
