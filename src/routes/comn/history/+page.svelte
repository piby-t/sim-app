<script lang="ts">
  /**
   * 実行履歴一覧ページ
   */
  import {
    Container, Table, Button, Badge, Card,
  } from "@sveltestrap/sveltestrap";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import type { SimReq, SimRes } from "$lib/types";

  let { data }: { data: PageData } = $props();

  /**
   * 履歴データの加工
   */
  let historyWithIndex = $derived(
    (data.history || [])
      .map((item: { req: SimReq; res: SimRes | null; timestamp: string }, idx: number) => ({ item, idx }))
      .reverse(),
  );

  /**
   * ステータスコードの抽出
   */
  function getStatus(res: SimRes | null | undefined): number | null {
    if (res && "status" in res) return res.status;
    return null;
  }

  /**
   * 時刻のフォーマット
   */
  function formatTime(timestamp: string | undefined): string {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }
</script>

<Container fluid class="mt-3">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h4 class="mb-0 fw-bold">通信履歴ダッシュボード</h4>
    
    <Button color="secondary" outline onclick={() => {
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      goto("/oauth/api");
    }}>
      <i class="bi bi-arrow-left me-1"></i> 設定に戻る
    </Button>
  </div>

  {#if historyWithIndex.length === 0}
    <Card class="text-center p-5 bg-light shadow-sm border-0">
      <div class="text-muted">
        <i class="bi bi-cloud-slash fs-1 d-block mb-3 opacity-25"></i>
        実行履歴がありません。
      </div>
    </Card>
  {:else}
    <div class="table-responsive shadow-sm border rounded bg-white">
      <Table hover class="mb-0 align-middle">
        <thead class="table-light">
          <tr>
            <th style="width: 70px;">No.</th>
            <th style="width: 100px;">Time</th>
            <th style="width: 100px;">Method</th>
            <th>リクエストURL</th>
            <th style="width: 100px;">Status</th>
            <th style="width: 90px;">詳細</th>
          </tr>
        </thead>
        <tbody>
          {#each historyWithIndex as { item, idx } (idx)}
            {@const status = getStatus(item.res)}

            <tr>
              <td class="small text-muted font-monospace">#{idx + 1}</td>
              <td class="small font-monospace text-secondary">{formatTime(item.timestamp)}</td>
              <td class="text-center">
                <Badge color={item.req.method === "POST" ? "primary" : "info"}>
                  {#if item.req.kind === "Authorization"}- {:else}{item.req.method || "-"}{/if}
                </Badge>
              </td>
              <td class="text-break small font-monospace">
                {#if item.req.kind === 'Display'}<Badge color="indigo" class="me-1">受信</Badge>{/if}
                {item.req.url}
              </td>
              <td>
                {#if status}
                  <Badge color={status < 400 ? "success" : "danger"}>{status}</Badge>
                {:else}
                  <Badge color="secondary">Redirect</Badge>
                {/if}
              </td>
              <td>
                <Button
                  color="primary"
                  size="sm"
                  outline
                  onclick={() => {
                    // eslint-disable-next-line svelte/no-navigation-without-resolve
                    goto(`/comn/history/${idx}`);
                  }}
                >
                  表示
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}
</Container>

<style>
  :global(.bg-indigo) { background-color: #6610f2 !important; }
  .text-break { word-break: break-all; }
  .font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
</style>