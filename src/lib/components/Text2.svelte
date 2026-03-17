<script lang="ts">
  /**
   * 名前と値の入力ペアコンポーネント (Text2.svelte)
   */
  import { Row, Col, Input, InputGroup, InputGroupText } from '@sveltestrap/sveltestrap';
  
  // プロパティの定義
  interface Props {
    name: string;
    value: string;
    onnamechange?: (val: string) => void;
    onvaluechange?: (val: string) => void;
  }

  let { name, value, onnamechange, onvaluechange }: Props = $props();
</script>

<div class="mb-2 mb-sm-1 item-row">
  <Row class="g-0 g-sm-1 align-items-center">
    <Col xs="12" sm>
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none bg-secondary text-white py-0" style="font-size: 0.7rem; min-width: 45px;">N</InputGroupText>
        <Input 
          type="text" 
          value={name} 
          oninput={(e) => onnamechange?.(e.currentTarget.value)}
          placeholder="" 
          class="form-control-sm py-0 bg-light-subtle fw-bold" 
          style="min-height: 26px; font-size: 0.85rem;"
        />
      </InputGroup>
    </Col>
    
    <Col xs="12" sm>
      <InputGroup size="sm">
        <InputGroupText class="d-sm-none bg-primary text-white py-0" style="font-size: 0.7rem; min-width: 45px;">V</InputGroupText>
        <Input 
          type="text" 
          value={value} 
          oninput={(e) => onvaluechange?.(e.currentTarget.value)}
          placeholder="" 
          class="form-control-sm py-0 border-start-sm-0" 
          style="min-height: 26px; font-size: 0.85rem;"
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