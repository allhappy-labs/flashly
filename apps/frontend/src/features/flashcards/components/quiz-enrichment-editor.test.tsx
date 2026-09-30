import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizEnrichment } from '@flashly/shared/src';

import {
    addQuizOption,
    QuizEnrichmentEditor,
    removeQuizOption,
    updateQuizOption,
} from './quiz-enrichment-editor';

const moduleRequire = createRequire(import.meta.url);
const { JSDOM } = moduleRequire('jsdom');

const quiz: QuizEnrichment = {
    prompt: 'Which article belongs to Vater?',
    options: ['der', 'die', 'das'],
    correctAnswer: 'der',
    explanation: 'Vater is masculine.',
};

const labels = {
    badge: 'Quiz',
    edit: 'Edit quiz',
    prompt: 'Question',
    option: (index: number) => `Option ${index}`,
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    addOption: 'Add option',
    removeOption: 'Remove option',
    apply: 'Apply quiz',
    cancel: 'Cancel',
    remove: 'Remove quiz',
    regenerate: 'Regenerate quiz',
    invalid: 'Choose one of the options as the correct answer.',
};

type RenderedEditor = Readonly<{ container: HTMLDivElement; root: Root }>;

async function renderEditor(
    overrides: Partial<ComponentProps<typeof QuizEnrichmentEditor>> = {},
): Promise<RenderedEditor> {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <QuizEnrichmentEditor
                quiz={quiz}
                labels={labels}
                onChange={vi.fn()}
                onRemove={vi.fn()}
                onRegenerate={vi.fn()}
                {...overrides}
            />,
        );
    });

    return { container, root };
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
    const button = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
    if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing ${label} button`);
    }
    return button;
}

function getInput(container: HTMLElement, label: string): HTMLInputElement {
    const input = [...container.querySelectorAll('input')].find(
        (candidate) => candidate.getAttribute('aria-label') === label,
    );
    if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Missing ${label} input`);
    }
    return input;
}

describe('quiz-enrichment-editor', () => {
    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>');
        vi.stubGlobal('window', dom.window);
        vi.stubGlobal('document', dom.window.document);
        vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
        vi.stubGlobal('HTMLButtonElement', dom.window.HTMLButtonElement);
        vi.stubGlobal('HTMLInputElement', dom.window.HTMLInputElement);
        vi.stubGlobal('HTMLTextAreaElement', dom.window.HTMLTextAreaElement);
        vi.stubGlobal('Event', dom.window.Event);
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('shows a quiz badge and collapsed summary before editing', async () => {
        const rendered = await renderEditor();

        expect(rendered.container.textContent).toContain('Quiz');
        expect(rendered.container.textContent).toContain(quiz.prompt);
        expect(rendered.container.textContent).toContain('Edit quiz');

        await act(async () => rendered.root.unmount());
    });

    it('opens editable question, choices, answer, and explanation controls', async () => {
        const rendered = await renderEditor();

        await act(async () => getButton(rendered.container, 'Edit quiz').click());
        expect(getInput(rendered.container, 'Question').value).toBe(quiz.prompt);
        expect(getInput(rendered.container, 'Option 1').value).toBe('der');
        expect(getInput(rendered.container, 'Correct answer').value).toBe('der');
        const explanation = rendered.container.querySelector('textarea');
        if (!(explanation instanceof HTMLTextAreaElement)) {
            throw new Error('Missing explanation textarea');
        }
        expect(explanation.value).toBe(quiz.explanation);
        expect(getButton(rendered.container, 'Add option').disabled).toBe(false);

        await act(async () => rendered.root.unmount());
    });

    it('keeps the editor open when the correct answer is not a choice', async () => {
        const onChange = vi.fn();
        const rendered = await renderEditor({
            onChange,
            quiz: { ...quiz, correctAnswer: 'unknown' },
        });

        await act(async () => getButton(rendered.container, 'Edit quiz').click());
        await act(async () => getButton(rendered.container, 'Apply quiz').click());

        expect(rendered.container.textContent).toContain(labels.invalid);
        expect(onChange).not.toHaveBeenCalled();

        await act(async () => rendered.root.unmount());
    });

    it('removes enrichment without removing the card', async () => {
        const onRemove = vi.fn();
        const rendered = await renderEditor({ onRemove });

        await act(async () => getButton(rendered.container, 'Remove quiz').click());

        expect(onRemove).toHaveBeenCalledOnce();

        await act(async () => rendered.root.unmount());
    });

    it('keeps the selected answer aligned while editing options and preserves option bounds', () => {
        const renamed = updateQuizOption(quiz, 0, 'Vater');
        const added = addQuizOption(renamed);
        const maxed = addQuizOption({ ...added, options: ['Vater', 'die', 'das', 'den'] });
        const removed = removeQuizOption(maxed, 0);
        const minimum = removeQuizOption({ ...removed, options: ['die', 'das'] }, 0);

        expect(renamed.correctAnswer).toBe('Vater');
        expect(renamed.options).toEqual(['Vater', 'die', 'das']);
        expect(added.options).toHaveLength(4);
        expect(maxed.options).toHaveLength(4);
        expect(removed.correctAnswer).toBe('die');
        expect(minimum.options).toEqual(['die', 'das']);
    });

    it('uses unique input and radio-group IDs for each editor instance', async () => {
        const container = document.createElement('div');
        document.body.append(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(
                <>
                    <QuizEnrichmentEditor quiz={quiz} labels={labels} onChange={vi.fn()} onRemove={vi.fn()} />
                    <QuizEnrichmentEditor quiz={quiz} labels={labels} onChange={vi.fn()} onRemove={vi.fn()} />
                </>,
            );
        });
        await act(async () => {
            const editButtons = [...container.querySelectorAll('button')].filter(
                (button) => button.textContent === 'Edit quiz',
            );
            for (const button of editButtons) {
                button.click();
            }
        });

        const promptIds = [...container.querySelectorAll('input[aria-label="Question"]')].map((input) => input.id);
        const radioNames = [...container.querySelectorAll('input[type="radio"]')].map((input) => input.getAttribute('name'));

        expect(new Set(promptIds).size).toBe(2);
        expect(new Set(radioNames).size).toBe(2);

        await act(async () => root.unmount());
    });

    it('disables every mutation control while saving', async () => {
        const rendered = await renderEditor({ disabled: true });

        expect(getButton(rendered.container, 'Edit quiz').disabled).toBe(true);
        expect(getButton(rendered.container, 'Regenerate quiz').disabled).toBe(true);
        expect(getButton(rendered.container, 'Remove quiz').disabled).toBe(true);

        await act(async () => rendered.root.unmount());
    });
});
