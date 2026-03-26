<script lang="ts">
  /**
   * @file クイックメモ（広域モード）
   * @description Badge のインポート漏れを修正し、高さを 1200px に固定した完全版
   */
  import { onMount } from "svelte";
  // ✅ 修正ポイント: Badge をインポートに追加
  import { Container, Button, Badge } from "@sveltestrap/sveltestrap";

  let memoContent = $state("");
  const LOCAL_STORAGE_KEY = "sim-app-memo-content";

  onMount(() => {
    if (typeof localStorage !== "undefined") {
      const storedContent = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedContent) {
        memoContent = storedContent;
      }
    }
  });

  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, memoContent);
    }
  });

  function clearMemo() {
    if (!confirm("メモの内容をすべて消去してよろしいですか？")) return;
    memoContent = "";
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }
</script>

<Container fluid class="h-100 py-3 d-flex flex-column">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="fw-bold text-primary mb-0">
      <i class="bi bi-journal-text me-2"></i>クイックメモ（広域モード）
    </h4>
    <Badge color="secondary" pill>Auto-save Enabled</Badge>
  </div>

  <div class="flex-grow-1 d-flex flex-column mb-3">
    <textarea
      bind:value={memoContent}
      placeholder="ログやトークン、構成案など、自由に貼り付けてください..."
      class="form-control shadow-sm border-2"
    ></textarea>
  </div>

  <div class="d-flex justify-content-between align-items-center border-top pt-3">
    <div class="text-muted small">
      <i class="bi bi-info-circle me-1"></i>
      現在の文字数: <strong>{memoContent.length.toLocaleString()}</strong> 文字
    </div>
    <Button color="danger" size="sm" class="fw-bold" onclick={clearMemo}>
      <i class="bi bi-trash3-fill me-1"></i>全消去
    </Button>
  </div>
</Container>

<style>
  textarea {
    /* 高さ 1200px (300px の 4倍) */
    min-height: 1200px; 
    
    /* 行間 1.8倍で視認性向上 */
    line-height: 1.8;
    
    /* エンジニア向け等幅フォント */
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.95rem;
    
    padding: 1.5rem;
    border-radius: 8px;
    background-color: #fdfdfd;
    resize: vertical;
  }

  textarea:focus {
    background-color: #ffffff;
    border-color: #0d6efd;
    box-shadow: 0 0 15px rgba(13, 110, 253, 0.15);
  }

  /* カスタムスクロールバー */
  textarea::-webkit-scrollbar {
    width: 10px;
  }
  textarea::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  textarea::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 5px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background: #bbb;
  }
</style>