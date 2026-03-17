<script lang="ts">
  /**
   * プリセット選択・一括チェック管理コンポーネント
   */
  import { FormGroup, Input, Row, Col } from '@sveltestrap/sveltestrap';
  import type { SelectArrayCheckProps } from '$lib/types';

  // Propsの定義
  let { 
    presets = [] as SelectArrayCheckProps[],
    selectedLabel = $bindable('') 
  } = $props();

  /**
   * 現在表示すべきアイテムグループを算出
   */
  let currentGroup = $derived(
    presets.find(p => p.label === selectedLabel) || presets[0]
  );

  /**
   * 初期化・整合性チェック
   */
  $effect(() => {
    if (presets.length > 0) {
      const exists = presets.some(p => p.label === selectedLabel);
      if (!selectedLabel || !exists) {
        selectedLabel = presets[0].label;
      }
    }
  });
</script>

<div class="select-array-check-container p-2 border rounded bg-white shadow-sm mb-3">
  <Row class="align-items-start g-2">
    <Col xs="12" md="4">
      <FormGroup class="mb-0">
        <Input 
          type="select" 
          bind:value={selectedLabel} 
          class="form-select-sm"
        >
          {#each presets as group (group.label)}
            <option value={group.label}>{group.label}</option>
          {/each}
        </Input>
      </FormGroup>
    </Col>

    <Col xs="12" md="8">
      <div class="d-flex flex-wrap gap-1">
        {#if currentGroup}
          {#each currentGroup.items as item (item.name)}
            <div class="check-item" class:is-checked={!!item.checked}>
              <label class="d-flex align-items-center mb-0 gap-2 px-2 py-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  bind:checked={item.checked} 
                  class="form-check-input mt-0"
                />
                <span class="small text-nowrap">{item.name}</span>
              </label>
            </div>
          {/each}
        {/if}
      </div>
    </Col>
  </Row>
</div>

<style>
  .cursor-pointer { cursor: pointer; }

  .check-item { 
    border: 1px solid #dee2e6; 
    border-radius: 6px; 
    background-color: #f8f9fa; 
    transition: all 0.2s;
    display: flex;
    align-items: center;
    height: 31px;
  }

  .check-item.is-checked { 
    background-color: #e7f1ff; 
    border-color: #0d6efd; 
    color: #0d6efd; 
  }
  
  :global(.form-select-sm) {
    height: 31px !important;
  }
</style>