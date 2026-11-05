# PDF Library Theme Parity

**Goal:** Make the PDF Library's reader, document list, controls, and failure
states follow the saved light/dark theme while preserving the browser's native
white PDF page and all existing viewer behavior.

**Architecture:** Keep markup and local viewer controls in the existing
presentational `PdfLibrary` component. Reuse root theme tokens; leave route,
query, and authenticated PDF content access unchanged.

## Tasks

1. [x] Add a rendered-component assertion for the reader's shared card surface and
       confirm it fails against the hard-coded dark styling.
2. [x] Convert PDF Library backgrounds, borders, muted text, actions, and error
       colors to the existing theme tokens.
3. [x] Run component and browser checks in light/dark themes at desktop/mobile
       widths, then run the UI gate and record the completed screen slice.

**Result:** The reader-surface regression was red against the prior fixed dark
class and green after tokenization. PDF controls and retry behavior remain
covered by their existing component tests. Browser checks confirmed desktop
dark and mobile light card/error colors and no horizontal overflow.

## Review focus

- Native PDF page remains white in both themes for document readability.
- Controls retain their disabled and focus-visible states.
- Empty, loading, list-error, preview-error, and selected-document states keep
  their existing behavior.
