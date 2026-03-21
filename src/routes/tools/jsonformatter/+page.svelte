<script lang="ts">
  import { Container, Row, Col } from "@sveltestrap/sveltestrap";

  let unformattedJson: string = "";
  let formattedJson: string = "";

  function formatJson() {
    try {
      const parsed = JSON.parse(unformattedJson);
      formattedJson = JSON.stringify(parsed, null, 2);
    } catch (e: unknown) {
      const error = e as Error;
      formattedJson = `Error: ${error.message}`;
    }
  }
</script>

<Container fluid class="h-100 py-3 d-flex flex-column">
  <h1 class="mb-3 text-center">JSON整形ツール</h1>
  <Row class="flex-grow-1 gy-3">
    <Col md="6" class="d-flex flex-column">
      <textarea
        bind:value={unformattedJson}
        on:input={formatJson}
        placeholder="整形前のJSONをここに貼り付けてください"
        class="form-control flex-grow-1"
      ></textarea>
    </Col>
    <Col md="6" class="d-flex flex-column">
      <textarea
        bind:value={formattedJson}
        readonly
        placeholder="整形後のJSONがここに表示されます"
        class="form-control flex-grow-1"
      ></textarea>
    </Col>
  </Row>
</Container>

<style>
  /* No custom styles needed for .json-formatter-container anymore, 
     as Bootstrap classes h-100, d-flex, and flex-column handle the layout.
     The textarea flex-grow-1 will make them take available height within their columns.
     Adding a min-height for readability on smaller content. */
  textarea {
    min-height: 300px; /* Adjust as needed for better appearance */
  }
</style>
