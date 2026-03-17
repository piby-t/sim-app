<script lang="ts">
  /**
   * プリセット選択・配列編集コンポーネント
   */
  import { Input, FormGroup } from '@sveltestrap/sveltestrap';
  import ArrayText2 from './ArrayText2.svelte';
  import type { SelectArrayText2Props } from '$lib/types';
  import { SelectArrayText2State } from '$lib/state/SelectArrayText2State.svelte';

  // Props定義
  let {
    presets = $bindable([] as SelectArrayText2Props[]),
    selectedLabel = $bindable(SelectArrayText2State.DEFAULT_VALUE)
  } = $props();

  /**
   * $derived を使用して、依存関係（presets, selectedLabel）が変わった際に
   * 自動的に再計算されるようにします。
   * これにより $state と $effect を使った手動同期が不要になります。
   */
  let current = $derived.by(() => {
    if (selectedLabel === SelectArrayText2State.DEFAULT_VALUE) return null;
    return presets.find(p => p.label === selectedLabel) || null;
  });

</script>

<div class="select-array-container p-2 border rounded bg-white shadow-sm">
  <FormGroup class="mb-3">
    <Input 
      type="select" 
      name="select"
      bind:value={selectedLabel}
      class="form-select-sm"
    >
      {#each presets as preset (preset.label)}
        <option value={preset.label}>{preset.label}</option>
      {/each}
    </Input>
  </FormGroup>

  <div class="data-section">
    {#if selectedLabel !== SelectArrayText2State.DEFAULT_VALUE && current}
      <ArrayText2 bind:items={current.items} />
    {/if}
  </div>
</div>

<style>
  .select-array-container {
    max-width: 100%;
  }
  
  :global(.form-select-sm) {
    border-color: #dee2e6;
  }
</style>