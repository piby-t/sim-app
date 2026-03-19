<script lang="ts">
  import type { ApiDefinition } from "$lib/types";

  /**
   * APIカタログ選択コンポーネント
   */
  let { 
    apiCatalog = {}, 
    selectedApi = $bindable(), 
    className = "form-select form-select-sm shadow-sm" 
  } = $props<{
    apiCatalog: Record<string, ApiDefinition[]>;
    selectedApi: ApiDefinition | null;
    className?: string;
  }>();

  // 現在選択されている値を `group|fileName` 形式で特定する
  const selectedValue = $derived.by(() => {
    if (!selectedApi) return "";
    // Object.entries の型を明示的に指定して推論を助ける
    const entries = Object.entries(apiCatalog) as [string, ApiDefinition[]][];
    for (const [group, list] of entries) {
      if (list.some((a: ApiDefinition) => a.fileName === selectedApi?.fileName)) {
        return `${group}|${selectedApi.fileName}`;
      }
    }
    return "";
  });

  function handleChange(e: Event & { currentTarget: HTMLSelectElement }) {
    const val = e.currentTarget.value;
    if (!val) {
      selectedApi = null;
      return;
    }
    const [group, fileName] = val.split("|");
    // 型安全にアクセス
    const targetGroup = apiCatalog[group];
    if (targetGroup) {
      selectedApi = targetGroup.find((a: ApiDefinition) => a.fileName === fileName) || null;
    }
  }
</script>

<select class={className} value={selectedValue} onchange={handleChange}>
  <option value="">APIを選択してください...</option>
  {#each Object.entries(apiCatalog) as [group, list] (group)}
    <optgroup label={group}>
      {#each (list as ApiDefinition[]) as api (api.fileName)}
        <option value="{group}|{api.fileName}">
          {api.display || api.fileName}
        </option>
      {/each}
    </optgroup>
  {:else}
    <option disabled>カタログが空です</option>
  {/each}
</select>