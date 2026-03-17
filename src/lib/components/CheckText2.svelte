<script lang="ts">
  /**
   * チェックボックス付きの2連入力行コンポーネント (CheckText2.svelte)
   * モバイル表示（スマホ）では縦並びに近いスタイルへ自動で切り替わります。
   */
  import { Row, Col, Input, InputGroup, InputGroupText } from '@sveltestrap/sveltestrap';
  
  // Svelte 5 Runes:
  // checked: 選択状態, val1: 項目名/ラベル, val2: 設定値
  // すべて $bindable なので、親リストのデータとリアルタイムに同期します。
  let { checked = $bindable(false), val1 = $bindable(''), val2 = $bindable('') } = $props();
</script>

<div class="mb-2 mb-sm-1 check-item-row p-1 p-sm-0" class:active-row={checked}>
  <Row class="g-0 g-sm-1 align-items-center">
    <Col xs="auto" class="pe-2 ps-1">
      <Input type="checkbox" bind:checked class="m-0" />
    </Col>
    
    <Col xs sm>
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none py-0" style="font-size: 0.6rem;">NAME</InputGroupText>
        <Input 
          type="text" 
          bind:value={val1} 
          placeholder="項目1" 
          class="form-control-sm py-0 bg-light" 
          style="min-height: 26px; font-size: 0.85rem;"
        />
      </InputGroup>
    </Col>
    
    <Col xs sm>
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none py-0" style="font-size: 0.6rem;">VALUE</InputGroupText>
        <Input 
          type="text" 
          bind:value={val2} 
          placeholder="項目2" 
          class="form-control-sm py-0" 
          style="min-height: 26px; font-size: 0.85rem;"
        />
      </InputGroup>
    </Col>
  </Row>
</div>

<style>
  /* チェックが入っている時に背景をわずかに青くして、選択中であることを強調 */
  .active-row {
    background-color: rgba(13, 110, 253, 0.05);
    border-radius: 4px;
  }

  /* モバイル（576px未満）向けスタイル調整 */
  @media (max-width: 575.98px) {
    /* モバイル時は1つの入力セットをカードのように見せて視認性を上げる */
    .check-item-row {
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 8px !important;
      background-color: white;
    }
  }
</style>