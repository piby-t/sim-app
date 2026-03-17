<script lang="ts">
  /**
   * 名前と値のリスト表示コンポーネント (ArrayText2.svelte)
   */
  import type { NameValue } from '$lib/types';
  import Text2 from './Text2.svelte';
  
  let { items = $bindable([] as NameValue[]) } = $props();

  /**
   * 参照を断ち切るための更新ロジック
   * スプレッド演算子で新しいオブジェクトを生成し、データの安全性（Immutability）を確保します。
   */
  function handleUpdate(i: number, field: 'name' | 'value', val: string) {
    items[i] = { ...items[i], [field]: val };
  }
</script>

<div class="border rounded p-2 bg-light shadow-sm">
  {#each items as item, i (i)}
    <Text2
      name={item.name} 
      value={item.value}
      onnamechange={(val) => handleUpdate(i, 'name', val)}
      onvaluechange={(val) => handleUpdate(i, 'value', val)}
    />
  {:else}
    <div class="text-center text-muted small py-2">
      変数が設定されていません
    </div>
  {/each}
</div>