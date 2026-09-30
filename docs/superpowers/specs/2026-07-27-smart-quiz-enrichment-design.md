# Smart Quiz Enrichment

## Summary

Flashly will support deliberate, AI-generated multiple-choice questions without creating a second deck or duplicating learning material. A flashcard remains the canonical learning item and may carry optional quiz enrichment: a custom prompt, deliberate answer options, one correct answer, and a concise explanation.

Learn and Test modes will prefer valid quiz enrichment when presenting a multiple-choice question. Cards without enrichment will retain the current generic behavior, which derives the question from the card and builds shuffled distractors from other cards in the deck.

Quiz generation will live in the existing web frontend generator and follow its established source, progress, preview, review, save, interruption, and retry flows. It will work both while creating new flashcards and while enriching cards in an existing deck.

## Goals

- Support intentional single-choice questions for any subject, not only languages.
- Keep one deck and one canonical set of flashcards for the same learning material.
- Let AI enrich new or existing flashcards with useful quiz mappings.
- Preserve the current zero-setup multiple-choice fallback for unenriched cards.
- Store quiz enrichment in the deck bundle for offline mobile learning and transfer.
- Provide concise explanations after learners answer enriched questions.
- Keep generation smart and lean by omitting enrichment when deliberate options add no value.

## Non-Goals

- A separate quiz deck type.
- Independent deck-owned quiz sets.
- Multiple-answer, true/false, or written AI-generated quiz formats in the first release.
- Separate quiz progress records that compete with flashcard learning progress.
- Replacing existing card content during quiz enrichment.
- Requiring every card to contain quiz enrichment.

## Product Model

A deck contains its existing flashcards. Each flashcard may additionally contain one optional quiz object:

```ts
type CardQuiz = {
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};
```

The first release permits two to four unique, non-empty options. `correctAnswer` is stored by value rather than by index because clients shuffle options for every learning session.

The flashcard front and back remain canonical. Quiz enrichment is additive and may ask a more useful question than a direct front-to-back translation.

Example:

```text
Front: Vater
Back: father

Quiz prompt: Which article belongs to “Vater”?
Options: der / die / das
Correct answer: der
Explanation: “Vater” is a masculine German noun, so it takes “der.”
```

The model is subject-neutral. The same structure can represent classifications, formulas, historical causes, scientific concepts, coding behavior, or other constrained-answer exercises.

## Frontend Generator Experience

### New learning material

The existing frontend generator gains a quiz-enhancement option. The user supplies source material and uses the established generator controls. When quiz enhancement is enabled, the generation result may include quiz data on cards for which intentional choices improve learning.

The generator must not create a second deck for the quiz. Saving creates one deck whose cards may contain enrichment.

### Existing decks

An existing deck exposes a **Generate Quiz** action that opens the same frontend generator in an enrichment mode. The user may enrich selected cards or the whole deck.

The generator receives the existing card content as context and proposes quiz objects only. It does not rewrite the card front, back, media, metadata, or learning progress.

### Smart generation

The prompt contract instructs the model to:

- create a single-answer multiple-choice question only when deliberate alternatives improve learning;
- generate two to four plausible, mutually distinct options;
- include the correct answer exactly once;
- avoid trick wording and ambiguous answers;
- provide a concise explanation focused on the concept or rule;
- omit quiz enrichment when the ordinary card-derived question is already sufficient.

This makes quiz generation an enhancement rather than a mandatory second representation of every card.

### Progress and partial results

Quiz generation reuses the current generator's progress, interruption, retry, and partial-result behavior. Generated enrichments remain proposals until the user reviews and explicitly saves them.

An interrupted or partially invalid response must never modify an existing deck automatically. Only reviewed, valid proposals are applied.

## Review Experience

An enriched card in generated results displays a **Quiz** indicator and an expandable quiz editor. The user can:

- preview the prompt and answer choices;
- edit the prompt, options, correct answer, and explanation;
- regenerate only that card's quiz enrichment;
- remove the enrichment while preserving the flashcard;
- exclude the entire card through the existing generated-result controls.

For an existing deck, the review presents quiz enrichments as pending changes. The final action is labeled **Add quizzes to deck** and updates only the reviewed quiz fields.

## Validation and Failure Handling

A quiz object is valid only when:

- its prompt is non-empty;
- it contains two to four unique, non-empty options;
- its correct answer matches exactly one option;
- its explanation is non-empty.

Shared validation is applied at AI-response parsing, frontend editing, persistence boundaries, bundle import, and mobile loading.

Invalid quiz enrichment is discarded or surfaced for correction without discarding its valid flashcard. A malformed quiz must never make a deck or card unreadable.

When enriching existing cards:

- front/back content and other metadata are immutable in the enrichment request;
- no change is persisted before explicit confirmation;
- a failed batch reports which cards were not enriched;
- successfully reviewed cards may be saved without requiring failed proposals.

## Learning Behavior

Learn mode and Test mode use one shared multiple-choice question resolver:

1. If a card contains valid quiz enrichment, use its custom prompt, deliberate options, correct answer, and explanation.
2. Otherwise, derive the prompt and answer from the flashcard using the existing format and answer-direction settings, then build distractors from other relevant cards.
3. Shuffle the resulting options for every session.

For enriched questions, the custom prompt takes precedence over the normal front/back direction. After selection, the UI:

- highlights the selected answer as correct or incorrect;
- reveals the correct answer when necessary;
- displays the concise explanation;
- requires the learner to continue explicitly.

Learning progress remains associated with the original flashcard. Quiz enrichment does not create a separate progress record.

Written recall, classic study, Match, Browse, and Write modes continue to use normal flashcard content.

For generic multiple-choice fallback, the existing answer-direction and format settings continue to apply. If fewer than two unique options can be produced, the session falls back to written recall instead of showing a meaningless single-option question.

## Persistence and Bundle Compatibility

Quiz enrichment follows the card through:

- shared TypeScript contracts and validation;
- frontend generated-result state;
- hosted API persistence where hosted mode is enabled;
- mobile local storage;
- `.flashly` bundle export and import.

The optional field is backward-compatible:

- old decks and bundles without quiz data work unchanged;
- clients that do not understand quiz enrichment can still read core card content;
- local and hosted generator modes use the same schema;
- invalid optional quiz data does not invalidate the containing card.

The `.flashly` bundle continues to represent one deck. Quiz enrichment is embedded with its corresponding card rather than exported as a separate deck or asset collection.

## Component Boundaries

Implementation should preserve focused boundaries:

- **Shared quiz contract and validator:** defines and validates optional card enrichment.
- **Quiz prompt builder/parser:** requests subject-neutral enrichment and returns validated proposals.
- **Generator integration:** supplies new-source or existing-card context and reuses generation lifecycle behavior.
- **Quiz review editor:** previews, edits, regenerates, removes, and selects proposals.
- **Persistence adapters:** store optional quiz data without changing unrelated card fields.
- **Multiple-choice resolver:** chooses curated enrichment or generic fallback independently of presentation.
- **Learning presentation:** renders selection feedback and explanations using resolved questions.

The resolver must not depend on React or persistence. This keeps selection and fallback behavior deterministic and unit-testable.

## Localization

All new user-visible frontend and mobile text uses shared translation keys. The initial implementation updates every supported locale rather than relying on hardcoded fallback strings.

Generated prompt, option, and explanation language follows the requested card language or source-language context. Language is a generation input, not a restriction on the quiz model.

## Verification

### Shared and generator tests

- Accept valid two-, three-, and four-option enrichment.
- Reject empty, duplicate, ambiguous, or missing-correct-answer options.
- Reject empty prompts and explanations.
- Preserve valid flashcards when quiz enrichment is invalid.
- Parse streamed and complete AI responses with optional enrichment.
- Recover partial valid results after interruption.
- Confirm prompts permit non-language subject matter and allow omission.

### Frontend tests

- Generate cards with optional quiz enrichment from source material.
- Enrich selected cards and whole existing decks.
- Verify existing front/back fields remain unchanged.
- Preview, edit, remove, and regenerate enrichment.
- Save only reviewed proposals.
- Report partial failures without losing successful proposals.
- Verify local and hosted modes share the contract while respecting their existing service boundaries.

### Persistence and transfer tests

- Round-trip enriched cards through hosted persistence and mobile local storage.
- Round-trip enriched cards through `.flashly` export/import.
- Load legacy bundles without quiz fields.
- Ignore invalid optional quiz data without losing card content.

### Learning tests

- Prefer valid enrichment in Learn and Test multiple-choice questions.
- Fall back to deck-derived distractors when enrichment is absent or invalid.
- Shuffle curated and generic options without losing the correct-answer mapping.
- Fall back to written recall when fewer than two unique options exist.
- Display feedback and explanations for enriched questions.
- Record progress against the original card.

### Acceptance checks

- Run a real frontend generation from source material, review it, and save one enriched deck.
- Enrich an existing deck without altering its original flashcard content.
- Export and import the enriched `.flashly` bundle.
- Run a real mobile Learn session and a Test multiple-choice question using curated options.
- Separately verify an unenriched card still uses the generic shuffled fallback.
