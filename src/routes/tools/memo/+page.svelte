<script lang="ts">
  import { onMount } from "svelte";
  import { Container, Button } from "@sveltestrap/sveltestrap";

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
    memoContent = "";
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }
</script>

<Container fluid class="h-100 py-3 d-flex flex-column">
  <h1 class="mb-3 text-center">クイックメモ</h1>
  <div class="flex-grow-1 d-flex flex-column mb-3">
    <textarea
      bind:value={memoContent}
      placeholder="ここにメモを書いてください..."
      class="form-control flex-grow-1"
    ></textarea>
  </div>
  <Button color="secondary" onclick={clearMemo} class="align-self-end">メモをクリア</Button>
</Container>

<style>
  textarea {
    min-height: 300px;
  }
</style>
