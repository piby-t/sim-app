<script lang="ts">
  /**
   * 履歴詳細表示ページ (+page.svelte)
   * 過去に実行された特定の通信ログを、リクエストとレスポンスのセットで詳細表示します。
   */
  import { Container, Row, Col, Card, Button } from "@sveltestrap/sveltestrap";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  
  // 表示用共通コンポーネントを再利用
  import SimRequest from "$lib/components/SimRequest.svelte";
  import SimResponse from "$lib/components/SimResponse.svelte";

  // Svelte 5 Props: サーバーのload関数からインデックスとレコードを受け取ります
  let { data }: { data: PageData } = $props();

  /**
   * リアクティブな実行記録の抽出 ($derived):
   * data 経由で渡された特定のインデックスのレコードを参照します。
   */
  let record = $derived(data.record);
</script>

<Container fluid class="mt-3 pb-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0">
      履歴詳細 
      <small class="text-muted fs-6">No. {String(data.index + 1)}</small>
    </h4>
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <Button color="secondary" outline onclick={() => goto('/comn/history')}>
      ← 履歴一覧へ
    </Button>
  </div>

  {#if !record}
    <Card class="text-center p-5 bg-light shadow-sm">
      <div class="text-muted">指定されたレコードが見つかりません。</div>
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
  /* 履歴詳細は内容の長さがレコードによって大きく異なるため、
    高さを固定せずコンテンツに合わせて自動伸長するように設定しています。
  */
  :global(.card) {
    height: auto !important;
  }
</style>