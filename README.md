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

## Releasing

To publish a new version of the plugin, follow these steps:

1. **Bump Version**: Update the version in `package.json` and `manifest.json`.
   ```json
   "version": "1.0.x"
   ```
2. **Commit and Push**:
   ```bash
   git add package.json manifest.json
   git commit -m "chore: bump version to 1.0.x"
   git push origin main
   ```
3. **Create Tag**: Push a tag matching `v*` to trigger the release workflow.
   ```bash
   git tag v1.0.x
   git push origin v1.0.x
   ```
4. **Automated Release**: GitHub Actions will automatically:
   - Build the plugin.
   - Sign the package using the `PRIVATE_KEY` secret.
   - Create a new GitHub release with the signed `plugin_package.zip`.

## Future Implementation

Inline editing of parameter values is not currently supported. The Caido SDK only provides `createSession` to create new replay sessions, not update the current view in-place. View modes are read-only views of request data. A future implementation could:

- Create a new replay session with modified parameters
- Integrate with Caido's replay functionality when SDK support is available
