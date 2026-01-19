# JSF Decoder

A Caido plugin for decoding and analyzing JavaServer Faces (JSF) request parameters.

## Features

- Automatic detection of JSF requests with confidence scoring
- Decodes and categorizes JSF parameters:
  - Standard JSF parameters (javax.faces.*, etc.)
  - Component ID parameters with hierarchy visualization
  - ViewState analysis (base64/encrypted detection)
  - Form submission markers
  - Custom parameters
- Value analysis with explanations (toggle with "Verbose" checkbox)
- Export as JSON or plain text

## Usage

1. Select a request in Caido
2. Open the JSF Decoder view
3. The plugin automatically parses and displays JSF parameters
4. Use the "Verbose" toggle to show/hide detailed value explanations
5. Copy decoded data using "Copy as Text" or "Copy as JSON"

## Future Implementation

Inline editing of parameter values is not currently supported. The Caido SDK only provides `createSession` to create new replay sessions, not update the current view in-place. View modes are read-only views of request data. A future implementation could:

- Create a new replay session with modified parameters
- Integrate with Caido's replay functionality when SDK support is available
