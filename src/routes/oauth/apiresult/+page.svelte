<script lang="ts">
  /**
   * API実行結果表示ページ (+page.svelte)
   * 最新のリクエスト送信内容と、それに対するレスポンスを並列(2ペイン)で表示します。
   */
  import { Container, Row, Col, Card, Button } from "@sveltestrap/sveltestrap";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  
  // 個別の表示用コンポーネントのインポート
  import SimRequest from "$lib/components/SimRequest.svelte";
  import SimResponse from "$lib/components/SimResponse.svelte";

  // Svelte 5 Props: サーバーのload関数からシリアライズされた通信記録を受け取ります
  let { data }: { data: PageData } = $props();

  /**
   * リアクティブな実行記録の抽出 ($derived):
   * data.record が更新されるたびに、自動的に最新のログを参照します。
   */
  let record = $derived(data.record);
</script>

<Container fluid class="mt-3 pb-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0">API実行結果</h4>
    <Button color="secondary" outline onclick={() => goto('/oauth/api')}>
      ← 設定画面に戻る
    </Button>
  </div>

  {#if !record}
    <Card class="text-center p-5 bg-light shadow-sm">
      <div class="text-muted">実行履歴が見つかりません。</div>
    </Card>
  {:else}
    <Row class="g-3">
      <Col md="6">
        <SimRequest req={record.req} />
      </Col>

      <Col md="6">
        <SimResponse res={record.res} />
      </Col>
    </Row>
  {/if}
</Container>

<style>
  /* レイアウト調整:
    左右のカードが高さを揃えつつ、内容が長い場合はスクロールさせずに
    ページ全体として伸びるように設定しています。
  */
  :global(.card) {
    height: auto !important;
    min-height: 100%;
  }

  /* 等幅フォントの標準化：OS間のフォントのばらつきを吸収します */
  :global(.font-monospace) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
  }
</style>