<script lang="ts">
  /**
   * スコープ文字列の生成・表示コンポーネント
   */
  import type { SelectArrayCheckProps } from '$lib/types';
  import { Row, Col, Input, InputGroup, InputGroupText } from '@sveltestrap/sveltestrap';
  import { untrack } from 'svelte';

  interface Props {
    selectedScopeData: SelectArrayCheckProps | undefined;
    name: string;
    value: string;
  }

  let { 
    selectedScopeData, 
    name = $bindable("scope"), 
    value = $bindable("") 
  }: Props = $props();

  /**
   * スコープ文字列の生成ロジック
   */
  let derivedScopeValue = $derived.by(() => {
    if (!selectedScopeData || !selectedScopeData.items) return "";
    return selectedScopeData.items
      .filter(item => item.checked)  // チェック済みを抽出
      .map(item => item.value)       // valueプロパティを抽出
      .join(" ");                    // スペースで結合
  });

  // 計算結果を親のステートに反映
  $effect(() => {
    const nextValue = derivedScopeValue;
    untrack(() => {
      value = nextValue;
    });
  });

  // 文字数に応じた高さの自動調整
  let dynamicRows = $derived(Math.max(Math.ceil((value?.length || 0) / 45), 1));
</script>

<div class="scope-display-container mb-2 item-row">
  <Row class="g-0 g-sm-1 align-items-start">
    <Col xs="12" sm="4">
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none bg-secondary text-white py-0" style="font-size: 0.7rem; min-width: 45px;">N</InputGroupText>
        <Input 
          type="text" 
          bind:value={name} 
          class="form-control-sm py-0 bg-light-subtle fw-bold" 
          style="min-height: 31px; font-size: 0.85rem;"
        />
      </InputGroup>
    </Col>

    <Col xs="12" sm="8">
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none bg-primary text-white py-0" style="font-size: 0.7rem; min-width: 45px;">V</InputGroupText>
        <Input 
          type="textarea" 
          bind:value={value} 
          rows={dynamicRows}
          class="form-control-sm py-1 bg-white display-area border-start-sm-0" 
          style="font-size: 0.85rem; line-height: 1.4; resize: none; overflow: hidden; min-height: 31px;"
        />
      </InputGroup>
    </Col>
  </Row>
</div>

<style>
  :global(.display-area) { border-color: #dee2e6; word-break: break-all; }
  
  @media (max-width: 575.98px) {
    :global(.item-row .col-12:first-child .input-group-text),
    :global(.item-row .col-12:first-child .form-control) {
      border-bottom-left-radius: 0 !important; border-bottom-right-radius: 0 !important;
    }
    :global(.item-row .col-12:last-child .input-group-text),
    :global(.item-row .col-12:last-child .form-control) {
      border-top-left-radius: 0 !important; border-top-right-radius: 0 !important; border-top: none !important;
    }
  }
</style>