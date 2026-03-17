<script lang="ts">
  /**
   * 認可コールバック結果表示画面 (+page.svelte)
   * 認可サーバーからリダイレクトで戻ってきた際の内容(code, state等)と、
   * システムによる検証結果を可視化します。
   */
  import { Container, Row, Col } from "@sveltestrap/sveltestrap";
  import SimRequest from "$lib/components/SimRequest.svelte";
  import SimResponse from "$lib/components/SimResponse.svelte";
  import type { PageData } from "./$types";

  // Svelte 5 Props: load関数で準備された実行記録を受け取ります
  let { data }: { data: PageData } = $props();
</script>

<Container fluid class="mt-4">
  <h4 class="mb-4">認可コールバック結果</h4>

  {#if data.record}
    <Row class="g-3">
      <Col lg="6">
        <SimRequest req={data.record.req} />
      </Col>
      <Col lg="6">
        <SimResponse res={data.record.res} />
      </Col>
    </Row>
  {:else}
    <div class="alert alert-warning text-center">
      表示できる履歴が見つかりませんでした。
    </div>
  {/if}
</Container>