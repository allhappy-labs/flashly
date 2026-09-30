One time exports to Anki, Quizlet, Brainscape

### 1. Overview

We will extend our current JSONL export so users can generate one time export files that match the import formats of popular flashcard apps. The system will be implemented in TypeScript via a small exporter interface plus per target exporters. Each export produces downloadable files (web) or saved files (CLI), with clear instructions where the target product requires manual steps.

Exporters are lazy loaded so unused formats do not affect bundle size or startup time.

### 2. Goals

* Export app data (JSONL cards + media folder + deck config) into:

  * **Anki**: `.apkg` packaged deck (primary)
  * **Quizlet**: UTF 8 text file
  * **Brainscape**: UTF 8 CSV
* Ensure every exporter produces downloadable files.
* Make it trivial to add new exporters.
* Ensure exports are deterministic, testable, and one off (no sync).

### 3. Non goals

* No account integrations or automatic uploads.
* No continuous sync.
* No guarantee of multimedia parity on platforms that do not support bulk media import.

---

### 4. Users and user stories

* As a user, I click “Export to Anki” and download a `.apkg` I can import directly into Anki Desktop.
* As a user, I click “Export to Quizlet” and download a text file I can paste into Quizlet’s import UI.
* As a user, I click “Export to Brainscape” and upload a CSV to create a deck.
* As a developer, I add a new exporter by implementing one interface and registering it.

---

### 5. Inputs

**Input data sources**

* JSONL file of cards (existing format)
* Media folder (images, audio, attachments)
* Deck configuration (deck name, metadata)

Each exporter consumes the parsed deck plus media path and produces files.

---

### 6. Outputs

Each exporter returns an `ExportResult`:

* One or more downloadable files (web) or saved files (CLI)
* Human readable instructions
* Optional warnings

```ts
type ExportResult = {
  formatId: string
  files: Array<{
    path: string
    mimeType: string
    bytes: Uint8Array
  }>
  instructionsMarkdown: string
  warnings?: Array<{
    code: string
    message: string
    cardIds?: string[]
  }>
  manifest?: {
    deckName: string
    exportedAt: string
    cardCount: number
    mediaIncluded: boolean
    notes?: string
  }
}
```

All exports are packaged as a single downloadable bundle (zip) containing:

* Main import file
* Optional media directory or archive
* README with format specific instructions

This keeps UX consistent across exporters.

---

### 7. Exporter interface, registry, and lazy loading

#### Interface

```ts
export interface IExportFormat {
  id: string
  label: string
  supportsMedia: "embedded" | "bundled" | "none"
  export(deck: Deck, options?: ExportOptions): Promise<ExportResult>
}
```

Common `ExportOptions`:

* `includeTags?: boolean`
* `lineEnding?: "LF" | "CRLF"`
* `includeMediaBundle?: boolean`

#### Registry

Exporters are registered via a central registry using lazy imports:

```ts
const exporters = {
  anki: () => import("./exporters/ankiApkg"),
  quizlet: () => import("./exporters/quizlet"),
  brainscape: () => import("./exporters/brainscapeCsv"),
}
```

Calling code resolves exporters dynamically:

```ts
const exporter = await exporters[formatId]()
```

This ensures unused exporters are not loaded.

UI and CLI enumerate available formats from registry metadata.

---

### 8. Format specific requirements

#### 8.1 Anki exporter (.apkg)

Primary Anki export is a packaged deck.

* Output: `deck-name.apkg`
* Contains:

  * Deck
  * Notes and cards
  * Media files (images, audio)
* Importing the file into Anki Desktop must:

  * Create the deck
  * Render media correctly
  * Preserve front/back fields
* Media is embedded inside the package.

Implementation notes:

* `.apkg` is a zip containing:

  * SQLite collection
  * media mapping file
  * media assets
* Deck name comes from config.
* Front field is the primary field for duplicate detection.
* Newlines inside fields are preserved as HTML.

Acceptance:

* Importing `.apkg` in Anki Desktop produces a usable deck with media, without manual steps.

---

#### 8.2 Quizlet exporter

Quizlet supports importing pasted text with term and definition separated by tab, comma, or dash.

* Output: `deck-name.quizlet.txt` (UTF 8)
* Format:

  * `term<TAB>definition`
  * One card per line

Rules:

* Tabs are used by default to avoid ambiguity.
* One line per card.
* UTF 8 encoding.

Media:

* Not embedded.
* Instructions explain that images/audio must be added manually.

---

#### 8.3 Brainscape exporter (CSV)

Brainscape supports CSV uploads.

* Output: `deck-name.brainscape.csv` (UTF 8)
* Columns:

  * `Question,Answer`
* Proper CSV quoting for commas, quotes, and newlines.
* One row per card.

Media:

* Not embedded.
* Optional `media.zip` included for manual use, with instructions.

---

### 9. Media handling (cross cutting)

* Media references are detected from cards.
* Filenames are normalised and deduplicated deterministically.
* Behaviour by exporter:

  * **Anki**: embedded inside `.apkg`
  * **Quizlet**: omitted
  * **Brainscape**: omitted from CSV, optionally bundled separately

If media files are missing, export continues with warnings.

---

### 10. Product workflow (one time export)

* UI: Export modal with:

  * Anki (.apkg)
  * Quizlet (TXT)
  * Brainscape (CSV)

Each action:

1. Lazily loads exporter
2. Runs export
3. Produces a downloadable bundle (zip)
4. User downloads and imports manually

Optional CLI:

```
export --format anki --input deck.jsonl --media ./media --out ./exports
```

No syncing or third party authentication.

---

### 11. Error handling and validation

* Validate cards before export:

  * Empty front/back
  * Missing media
  * Invalid UTF 8
* Export proceeds where possible and reports warnings:

  * `EMPTY_FRONT`
  * `MISSING_MEDIA_FILE`
  * `DUPLICATE_MEDIA_NAME`

---

### 12. Testing

All exporters must be covered with **Vitest**.

#### Unit tests

* CSV quoting and escaping
* Quizlet line formatting
* Deterministic ordering
* Media bundling logic
* Filename normalisation

#### Golden file tests

For each exporter:

* Snapshot exported files for a fixture deck containing:

  * commas, quotes, tabs, newlines
  * unicode
  * images and audio

#### Integration tests

* Run exporter end to end and assert:

  * Files are produced
  * Manifest matches expectations
  * Media inclusion rules are respected

Anki `.apkg`:

* Structural validation (zip contents)
* Media mapping exists
* SQLite schema present

---

### 13. Acceptance criteria

* Anki export produces valid `.apkg` with embedded media.
* Quizlet export produces UTF 8 text with tab separated term/definition.
* Brainscape export produces UTF 8 CSV with Question/Answer columns.
* Every exporter:

  * Is lazy imported
  * Produces downloadable files
  * Has Vitest coverage
* Adding a new exporter only requires implementing `IExportFormat` and registering it.

---

### 14. Deliverables

* Core:

  * `IExportFormat`
  * Export registry with lazy imports
  * Shared helpers (CSV, ZIP, media, encoding)
* Exporters:

  * `anki-apkg`
  * `quizlet-txt`
  * `brainscape-csv`
* Tests:

  * Vitest unit + golden tests per exporter
* Docs:

  * README section per exporter with import steps and limitations
