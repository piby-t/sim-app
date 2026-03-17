<script lang="ts">
  /**
   * 項目選択・テキスト編集コンポーネント
   */
  import type { NameValue } from '$lib/types';
  import { Row, Col, Input } from '@sveltestrap/sveltestrap';

  // Props定義
  let { 
    items = $bindable([] as NameValue[]),
    selectedLabel = $bindable(''),
  } = $props();

  /**
   * 現在選択されているアイテムへの参照 ($derived)
   */
  let currentItem = $derived(
    items.find(item => item.name === selectedLabel)
  );

  /**
   * テキストエリアの行数計算 ($derived)
   */
  let dynamicRows = $derived(
    Math.min(Math.max(Math.ceil((currentItem?.value?.length || 0) / 50), 2), 10)
  );

  /**
   * 初期化ロジック ($effect)
   */
  $effect(() => {
    if (!selectedLabel && items.length > 0) {
      selectedLabel = items[0].name;
    }
  });
</script>

<div class="select-text-container p-2 border rounded bg-white shadow-sm mb-3">
  <Row class="align-items-start g-2">
    <Col xs="12" md="4">
      <Input 
        type="select" 
        bind:value={selectedLabel} 
        class="form-select-sm"
        style="height: 31px;"
      >
        {#each items as item (item.name)}
          <option value={item.name}>{item.name}</option>
        {/each}
      </Input>
    </Col>

    <Col xs="12" md="8">
      {#if currentItem}
        <Input 
          type="textarea" 
          bind:value={currentItem.value}
          rows={dynamicRows}
          class="form-control-sm py-1 bg-white url-display" 
          style="font-size: 0.85rem; line-height: 1.4; resize: none;"
        />
      {:else}
         <div class="form-control-sm py-1 bg-light text-muted small border rounded">データがありません</div>
      {/if}
    </Col>
  </Row>
</div>

<style>
  :global(.form-select-sm) {
    border-color: #dee2e6;
  }

  :global(.url-display) {
    border-color: #dee2e6;
    word-break: break-all;
    overflow-y: hidden;
    resize: none !important;
  }

  @media (max-width: 767.98px) {
    :global(.url-display) {
      margin-top: 4px;
    }
  }
</style>