export const FLASHCARD_MATERIAL_TYPE_INSTRUCTIONS = {
    General: [
        '- Focus on clear, general facts and definitions from the source.',
        '- Prefer everyday contexts in examples.',
        '- Avoid domain-specific jargon unless it appears in the material.',
    ].join('\n'),
    Language: [
        'For language learning cards generation:',
        '- Keep the front to one word, short phrase, or a minimal cloze.',
        '- Use only meanings/translations present in the material; do not invent if not specifically instructed to.',
        '- If the front is a noun with grammatical gender, include "gender" (masculine, feminine, neuter, or common) as a separate field.',
        '- Do NOT include gender information in the front text itself (e.g., use "table" not "table (m)").',
        '- Add word stress directly on the front for multi-syllable terms by bolding the stressed syllable using markdown bold syntax (e.g., ba**na**na, re**cor**der, a**b**sorptent).',
        '- For stress placement: apply primary stress rules appropriate for the target language. When uncertain, mark the most common stress pattern.',
        '- Skip stress marking for monosyllabic words.',
        '- Optionally include IPA pronunciation in the back or example field if it aids learning (e.g., /bəˈnɑːnə/), using standard IPA notation.',
        '- The example should be neutral and simple, short, and avoid idioms unless in the source.',
        '- Keep the example in the same language as the front unless the source provides a translation.',
    ].join('\n'),
    Medical: [
        '- Only use clinically accurate facts present in the material; do not add advice or diagnoses.',
        '- Preserve units, ranges, and thresholds exactly as stated.',
        '- Prefer standard terminology; include abbreviations only if present in the source.',
        '- Examples should be brief clinical contexts when helpful.',
    ].join('\n'),
    'Computer Science': [
        '- Focus on definitions, algorithms, data structures, or APIs as stated in the material.',
        '- Include notation (e.g., Big-O) or code only if it appears in the source.',
        '- Keep the front conceptual; put formulas, steps, or snippets on the back.',
        '- Examples can be short code or scenarios drawn from the material.',
    ].join('\n'),
    Mathematics: [
        '- Focus on formulas, theorems, definitions, and problem-solving steps.',
        '- Include notation precisely as it appears in the material.',
        '- Prefer symbolic representation on the front; explanations on the back.',
        '- Examples should show calculation steps or application contexts.',
        '- Keep one concept per card (e.g., one formula, one theorem).',
    ].join('\n'),
    Physics: [
        '- Focus on laws, principles, formulas, units, and physical phenomena.',
        '- Preserve symbols, constants, and units exactly as stated.',
        '- Include the formula or law on the front; explanation/application on the back.',
        '- Examples can be problem scenarios or real-world applications.',
        '- Avoid combining multiple laws in a single card.',
    ].join('\n'),
    Chemistry: [
        '- Focus on elements, compounds, reactions, formulas, and periodic trends.',
        '- Include chemical formulas, equations, and notation exactly as written.',
        '- Use element names or symbols as they appear in the source.',
        '- Preserve reaction conditions, states of matter, and stoichiometry.',
        '- Examples can be reaction scenarios or element properties.',
    ].join('\n'),
    Biology: [
        '- Focus on organisms, processes, structures, functions, and terminology.',
        '- Use scientific names and taxonomy when present in the material.',
        '- Include Latin terms only if they appear in the source.',
        '- Examples should relate to real organisms or biological contexts.',
        '- Keep one structure, process, or concept per card.',
    ].join('\n'),
    History: [
        '- Focus on events, figures, dates, causes, and consequences.',
        '- Preserve dates exactly as stated in the material.',
        '- One event, figure, or period per card.',
        '- Examples should be specific historical instances or quotes.',
        '- Avoid forcing chronology; focus on causal relationships.',
    ].join('\n'),
    Geography: [
        '- Focus on locations, physical features, capitals, and relationships.',
        '- Include place names exactly as written in the source.',
        '- One location or feature per card.',
        '- Examples can be regional contexts or comparative facts.',
        '- Preserve coordinates, elevations, or measurements if present.',
    ].join('\n'),
    Psychology: [
        '- Focus on theories, disorders, researchers, methods, and concepts.',
        '- Use terminology as it appears in the material.',
        '- One theory, concept, or researcher per card.',
        '- Examples should be experimental contexts or real-world applications.',
        '- Avoid mixing multiple theories in a single card.',
    ].join('\n'),
    Economics: [
        '- Focus on concepts, models, terminology, and economic principles.',
        '- Include graphs or equations only if present in the source.',
        '- One concept or model per card.',
        '- Examples should be market scenarios or policy applications.',
        '- Preserve mathematical notation if it appears in the material.',
    ].join('\n'),
    Law: [
        '- Focus on legal terms, case names, principles, and statutory elements.',
        '- Include case citations or statute numbers only if present in the source.',
        '- One term, case, or principle per card.',
        '- Examples should be fact patterns or applications.',
        '- Avoid legal advice; stick to definitions and principles.',
    ].join('\n'),
    Business: [
        '- Focus on management concepts, marketing terms, frameworks, and strategies.',
        '- Use business terminology as it appears in the material.',
        '- One concept or framework per card.',
        '- Examples should be company scenarios or industry applications.',
        '- Avoid mixing multiple frameworks in a single card.',
    ].join('\n'),
    Music: [
        '- Focus on theory, notation, composers, instruments, and periods.',
        '- Include musical symbols, terms, or notation exactly as written.',
        '- One concept, composer, or work per card.',
        '- Examples can be specific pieces or musical contexts.',
        '- Preserve foreign musical terms (Italian, German) if in the source.',
    ].join('\n'),
    Art: [
        '- Focus on movements, artists, techniques, works, and periods.',
        '- Use art terminology as it appears in the material.',
        '- One artist, movement, or technique per card.',
        '- Examples should be specific artworks or stylistic contexts.',
        '- Include dates only if present in the material.',
    ].join('\n'),
    Engineering: [
        '- Focus on principles, formulas, disciplines, and applications.',
        '- Include equations, units, and technical notation precisely.',
        '- One concept or formula per card.',
        '- Examples should be engineering applications or problems.',
        '- Avoid mixing multiple engineering disciplines in one card.',
    ].join('\n'),
    'Data Science': [
        '- Focus on algorithms, statistical concepts, ML methods, and terminology.',
        '- Include code snippets or equations only if present in the source.',
        '- One algorithm, concept, or metric per card.',
        '- Examples should be data contexts or use cases.',
        '- Preserve technical notation and library names as written.',
    ].join('\n'),
    Philosophy: [
        '- Focus on concepts, philosophers, movements, and arguments.',
        '- Use philosophical terminology as it appears in the material.',
        '- One concept or philosopher per card.',
        '- Examples should be thought experiments or specific arguments.',
        '- Avoid mixing multiple philosophical traditions in one card.',
    ].join('\n'),
    Literature: [
        '- Focus on authors, works, literary devices, and movements.',
        '- Include titles, character names, and quotations as written.',
        '- One author, work, or device per card.',
        '- Examples should be specific passages or plot contexts.',
        '- Preserve foreign language quotes only if in the source.',
    ].join('\n'),
    Sociology: [
        '- Focus on theories, theorists, concepts, and research methods.',
        '- Use sociological terminology as it appears in the material.',
        '- One theory or theorist per card.',
        '- Examples should be social contexts or study findings.',
        '- Avoid combining multiple theoretical frameworks.',
    ].join('\n'),
    'Political Science': [
        '- Focus on systems, institutions, theories, and political concepts.',
        '- Include terms exactly as written in the material.',
        '- One system, institution, or concept per card.',
        '- Examples should be country contexts or historical cases.',
        '- Avoid mixing multiple political systems in one card.',
    ].join('\n'),
} as const;

export function getFlashcardMaterialTypeInstruction(materialType: string): string {
    return (
        FLASHCARD_MATERIAL_TYPE_INSTRUCTIONS[
            materialType as keyof typeof FLASHCARD_MATERIAL_TYPE_INSTRUCTIONS
        ] ?? FLASHCARD_MATERIAL_TYPE_INSTRUCTIONS.General
    );
}

export const FLASHCARD_PROMPT_TEMPLATE = `You are generating flashcards optimized for FSRS (Free Spaced Repetition Scheduler).
Convert the provided source input into high-quality flashcards designed for long-term retention using FSRS principles.
The Source may contain study notes, raw facts, or a short generation request.
Use markdown where applicable on the front/back side of a card or in the example, but only if it improves clarity.

Task
- {{countInstruction}}
- {{sourcePolicyInstruction}}
- If existing questions are provided below, do not repeat or paraphrase them.

FSRS rules
- One card = one atomic fact.
- One word, one form, one short phrase, or one rule.
- Never mix multiple concepts in a single card.
- Active recall first.
- Front must force recall, not recognition.
- Avoid lists, tables, or explanations on the front.
- Context is critical.
- Every card should include an example when it improves learning.

Examples must be:
- short
- natural
- avoid redundancy
- do not duplicate cards
- no noise
- no lesson notes, page numbers, comments, or theory dumps
- skip rare or low-frequency items unless explicitly requested

Grammar cards rules
- One rule per card.
- Prefer form -> meaning/use.
- Avoid theory; show usage through structure.

Word card rules
- Add emphasis to words with bold markdown.

{{languageInstruction}}

{{quizInstruction}}

Material type instructions
{{materialTypeInstruction}}

Deck Metadata
- First, generate a concise deck name (3-8 words) that captures the essence of the study material
- Then, generate a brief description (1-2 sentences) summarizing what the deck covers
- The name should be specific but concise (e.g., "Spanish Basic Verbs" not "Comprehensive Spanish Language Learning Materials")
- The description should help users understand the deck's scope and focus

Output format
- First line: deck name as JSON string
- Second line: deck description as JSON string
- Then a blank line
- Then the flashcard JSONL as specified below
- If Source is empty after trimming and flashcards cannot be generated, return exactly one JSON object:
  {"error":{"code":"INSUFFICIENT_SOURCE","message":"Not enough source content to generate flashcards."}}

- The flashcard output must be valid JSONL (JSON Lines).
- Return only JSONL with one JSON object per line, or the JSON error object above. Do not wrap output in an array.
- Each line must include "front" and "back". Optional fields can be omitted or set to null.
- Do not return plain text explanations.
- If Source contains any usable topic/request text, generate cards in instruction-only mode instead of returning INSUFFICIENT_SOURCE.

JSONL format
- No empty lines anywhere in the flashcard section.
- No explanations outside JSONL.
- No duplicate entries.
- No comments.

Before producing the output, verify:
- Valid JSON on every line.
- No empty lines.
- Each object includes front/back.
- Tags are arrays.
- Content supports FSRS (atomic, recall-based).

Existing questions
{{previousQuestions}}

Source
{{sourceMaterial}}

{{customInstruction}}`;
