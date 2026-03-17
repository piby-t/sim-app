<script lang="ts">
  /**
   * 受信リクエスト・ビューアー (+page.svelte)
   * 本ツールが外部から受け取った HTTP リクエストの内容（メソッド、URL、ヘッダー、ボディ等）
   * をリアルタイムまたは履歴から抽出して表示するための確認用画面です。
   */
  import { Container, Row, Col, Button, Alert } from '@sveltestrap/sveltestrap';
  import SimRequest from '$lib/components/SimRequest.svelte';
  import type { PageData } from './$types';

  // Svelte 5 Props: サーバー側でキャプチャされた最新のリクエストデータを受け取ります
  let { data }: { data: PageData } = $props();
</script>

<Container class="py-4">
  <Row class="justify-content-center">
    <Col md={10} lg={8}>
      <div class="d-flex align-items-center justify-content-between mb-4">
        <h4 class="mb-0 fw-bold text-indigo">
          <i class="bi bi-box-arrow-in-right me-2"></i>Captured Request
        </h4>
        <Button color="primary" href="/oauth/history" size="sm shadow-sm">履歴一覧へ戻る</Button>
      </div>

      {#if data.lastReq}
        <SimRequest req={data.lastReq} res={data.lastRes} />
      {:else}
        <Alert color="warning">
          リクエストが見つかりませんでした。正しいエンドポイントにアクセスされているか、またはセッションID（simses）が一致しているか確認してください。
        </Alert>
      {/if}
    </Col>
  </Row>
</Container>

<style>
  /* 外部からのインカムリクエスト（受信）を示すインディゴカラーを定義 */
  :global(.text-indigo) { color: #6610f2 !important; }
</style>