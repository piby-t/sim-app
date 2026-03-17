<script lang="ts">
  /**
   * 複数の CheckText2 をリスト表示するためのラッパーコンポーネント。
   *
   * @property {Array} items - 表示する項目の配列。
   * 各要素は `{ checked: boolean, label: string, value: string }` の構造を想定しています。
   * ※レンダリングを最適化するため、各アイテムの `label` は一意（ユニーク）である必要があります。
   */
  import CheckText2 from './CheckText2.svelte';
  
  // 親コンポーネントとの間で bind:items による状態の双方向バインディングを許可
  let { items = $bindable([]) } = $props();
</script>

<div class="border rounded p-2 bg-light shadow-sm">
  {#each items as item (item.label)}
    <CheckText2
      bind:checked={item.checked}
      bind:val1={item.label}
      bind:val2={item.value}
    />
  {:else}
    <div class="text-center text-muted small py-2">
      項目が設定されていません
    </div>
  {/each}
</div>