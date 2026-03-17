<script lang="ts">
  /**
   * Basic認証文字列の自動計算コンポーネント
   */
  import { Row, Col, Input, InputGroup, InputGroupText } from '@sveltestrap/sveltestrap';
  import type { NameValue, SelectArrayText2Props } from '$lib/types';

  // Propsの型定義
  interface Props {
    clientData: SelectArrayText2Props | undefined;
    result: string;
  }

  let { clientData, result = $bindable("") }: Props = $props();

  /**
   * clientData内の情報からBasic認証文字列(Base64)を計算
   */
  let base64Result = $derived.by(() => {
    if (!clientData?.items) return "";

    const clientId = clientData.items.find((i: NameValue) => i.name === 'clientid')?.value || "";
    const secret = clientData.items.find((i: NameValue) => i.name === 'secret')?.value || "";

    if (!clientId && !secret) return "";

    try {
      // "id:password" の形式をBase64エンコード
      return btoa(`${clientId}:${secret}`);
    } catch {
      // エンコード失敗時は安全なメッセージを返す
      return "Error: Invalid characters"; 
    }
  });

  /**
   * 計算結果を親コンポーネントへ同期
   */
  $effect(() => {
    result = base64Result;
  });
</script>

<div class="mt-3 p-2 border rounded bg-light-subtle item-row">
  <h6 class="text-muted small fw-bold mb-2">Basic認証 (自動計算)</h6>
  <Row class="g-0 g-sm-1 align-items-center">
    <Col xs="12" sm="4">
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none bg-secondary text-white py-0" style="font-size: 0.7rem; min-width: 45px;">N</InputGroupText>
        <Input 
          value="secret_base64"
          readonly 
          class="form-control-sm py-0 bg-light fw-bold" 
          style="min-height: 26px; font-size: 0.8rem;"
        />
      </InputGroup>
    </Col>
    
    <Col xs="12" sm="8">
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none bg-primary text-white py-0" style="font-size: 0.7rem; min-width: 45px;">V</InputGroupText>
        <Input 
          value={base64Result} 
          readonly 
          placeholder="Basic Auth will appear here..."
          class="form-control-sm py-0 bg-white border-start-sm-0" 
          style="min-height: 26px; font-size: 0.8rem;"
        />
      </InputGroup>
    </Col>
  </Row>
</div>

<style>
  @media (max-width: 575.98px) {
    :global(.item-row .col-12:first-child .input-group-text),
    :global(.item-row .col-12:first-child .form-control) {
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }
    :global(.item-row .col-12:last-child .input-group-text),
    :global(.item-row .col-12:last-child .form-control) {
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
      border-top: none !important;
    }
  }
</style>