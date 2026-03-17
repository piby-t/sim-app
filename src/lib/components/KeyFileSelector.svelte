<script lang="ts">
  /**
   * 鍵ファイル選択・内容表示コンポーネント
   * 選択された鍵ファイルの記憶（localStorage）と、その中身のJSON構造の可視化を行います。
   */
  import { Card, CardHeader, CardBody, Badge, Spinner } from "@sveltestrap/sveltestrap";
  import { browser } from "$app/environment";
  import { untrack } from "svelte";
  import type { JsonValue } from "$lib/types";

  interface Props {
    keyFiles: string[];
    selectedKeyFile: string;
  }

  let { keyFiles = [], selectedKeyFile = $bindable("") }: Props = $props();

  let keyData = $state<Record<string, JsonValue> | null>(null);
  let loading = $state(false);

  const STORAGE_KEY = 'fido_last_selected_key';

  // ヘルパー：JWKオブジェクトかどうか判定
  const isJwk = (key: string) => key.toLowerCase().includes('jwk');

  /**
   * マウント時の初期化と復元ロジック
   */
  $effect(() => {
    if (!browser) return;

    untrack(() => {
      // 親からすでに値が渡されている場合（新規作成直後など）はそれを保存して優先
      if (selectedKeyFile) {
        localStorage.setItem(STORAGE_KEY, selectedKeyFile);
        return;
      }

      // 指定がない場合は localStorage から過去の選択履歴を復元
      const savedKey = localStorage.getItem(STORAGE_KEY);
      
      if (savedKey && keyFiles.includes(savedKey)) {
        selectedKeyFile = savedKey;
      } else if (keyFiles.length > 0) {
        // 保存値がない、またはファイルが削除されている場合は最新の鍵を選択
        selectedKeyFile = keyFiles[0];
      }
    });
  });

  /**
   * 選択された鍵ファイルが変更された時の処理（保存と内容のフェッチ）
   */
  $effect(() => {
    if (selectedKeyFile) {
      if (browser) localStorage.setItem(STORAGE_KEY, selectedKeyFile);
      fetchContent(selectedKeyFile);
    } else {
      keyData = null;
    }
  });

  async function fetchContent(fileName: string) {
    loading = true;
    try {
      const res = await fetch(`/fido/key-content?file=${fileName}`);
      if (!res.ok) throw new Error("Load failed");
      keyData = await res.json() as Record<string, JsonValue>;
    } catch {
      console.error("Failed to load key content");
      keyData = { error: "読み込み失敗" };
    } finally {
      loading = false;
    }
  }
</script>

{#snippet renderValue(value: JsonValue)}
  {#if value === null}
    <span class="text-muted small">null</span>
  {:else if Array.isArray(value)}
    <div class="d-flex flex-wrap gap-1">
      {#each value as item, i (i)}
        <Badge color="light" class="text-dark border">{@render renderValue(item)}</Badge>
      {/each}
    </div>
  {:else if typeof value === 'object'}
    <div class="nested-obj-grid">
      {#each Object.entries(value) as [k, v] (k)}
        <div class="grid-item">
          <div class="grid-label">{k}</div>
          <div class="grid-value">{@render renderValue(v)}</div>
        </div>
      {/each}
    </div>
  {:else if typeof value === 'string' && value.length > 25}
    <span class="text-primary font-monospace text-break" title={value}>
      {value}
    </span>
  {:else}
    <span class="text-dark fw-medium">{value}</span>
  {/if}
{/snippet}

{#snippet renderJwkContent(obj: Record<string, JsonValue>)}
  <div class="jwk-inner-flex">
    {#each Object.entries(obj) as [k, v] (k)}
      <div class="jwk-tag">
        <span class="jwk-tag-label">{k}</span>
        <span class="jwk-tag-value">{@render renderValue(v)}</span>
      </div>
    {/each}
  </div>
{/snippet}

<Card class="shadow-sm border-0 mb-3">
  <CardHeader class="bg-primary text-white py-2 d-flex justify-content-between align-items-center">
    <h6 class="mb-0"><i class="bi bi-key-fill me-2"></i>使用する鍵ファイル</h6>
    {#if loading}<Spinner size="sm" color="light" />{/if}
  </CardHeader>
  <CardBody class="p-3">
    <select class="form-select form-select-sm mb-3 shadow-sm font-monospace" bind:value={selectedKeyFile}>
      {#if keyFiles.length === 0}
        <option value="">鍵ファイルがありません</option>
      {:else}
        {#each keyFiles as file (file)}
          <option value={file}>{file.replace('.json', '')}</option>
        {/each}
      {/if}
    </select>

    {#if keyData}
      <div class="content-wrapper">
        <div class="top-level-grid">
          {#each Object.entries(keyData) as [key, val] (key)}
            <div class="top-item shadow-sm border rounded p-2 bg-white {isJwk(key) ? 'is-jwk-wide' : ''}">
              <div class="top-label">{key}</div>
              <div class="top-value">
                {#if isJwk(key) && val !== null && typeof val === 'object' && !Array.isArray(val)}
                  {@render renderJwkContent(val as Record<string, JsonValue>)}
                {:else}
                  {@render renderValue(val)}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </CardBody>
</Card>

<style>
  .font-monospace { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
  .content-wrapper { width: 100%; }
  .top-level-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
  @media (min-width: 576px) {
    .top-level-grid { grid-template-columns: repeat(2, 1fr); }
    .is-jwk-wide { grid-column: span 2; }
  }
  @media (min-width: 1200px) {
    .top-level-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .top-level-grid .is-jwk-wide { grid-column: span 2; }
  }
  .top-item { display: flex; flex-direction: column; min-width: 0; background-color: #fff; }
  .top-label { font-size: 0.65rem; font-weight: bold; color: #6c757d; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px solid #f8f9fa; }
  .top-value { font-size: 0.8rem; }
  .jwk-inner-flex { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0; }
  .jwk-tag { background: #f8f9fa; border: 1px solid #eee; border-radius: 4px; padding: 2px 6px; display: flex; flex-direction: column; min-width: 80px; }
  .jwk-tag-label { font-size: 0.6rem; color: #999; font-weight: bold; line-height: 1; margin-bottom: 2px; }
  .jwk-tag-value { font-size: 0.75rem; word-break: break-all; }
  .nested-obj-grid { display: flex; flex-direction: column; gap: 2px; }
  .grid-item { display: flex; justify-content: space-between; font-size: 0.75rem; border-bottom: 1px dashed #f0f0f0; padding: 2px 0; }
  .grid-label { color: #888; margin-right: 8px; flex-shrink: 0; }
  .grid-value { text-align: right; word-break: break-all; color: #333; }
</style>