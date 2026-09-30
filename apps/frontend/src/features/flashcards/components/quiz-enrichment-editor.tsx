import { useEffect, useId, useState } from 'react';
import { CirclePlus, RefreshCw, Trash2 } from 'lucide-react';
import { QuizEnrichmentSchema, type QuizEnrichment } from '@flashly/shared/src';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type QuizEnrichmentEditorLabels = Readonly<{
    badge: string;
    edit: string;
    prompt: string;
    option: (index: number) => string;
    correctAnswer: string;
    explanation: string;
    addOption: string;
    removeOption: string;
    apply: string;
    cancel: string;
    remove: string;
    regenerate: string;
    invalid: string;
}>;

type QuizEnrichmentEditorProps = Readonly<{
    quiz: QuizEnrichment;
    labels: QuizEnrichmentEditorLabels;
    onChange: (quiz: QuizEnrichment) => void;
    onRemove: () => void;
    onRegenerate?: () => void;
    isRegenerating?: boolean;
    disabled?: boolean;
}>;

function copyQuiz(quiz: QuizEnrichment): QuizEnrichment {
    return {
        prompt: quiz.prompt,
        options: [...quiz.options],
        correctAnswer: quiz.correctAnswer,
        explanation: quiz.explanation,
    };
}

export function updateQuizOption(quiz: QuizEnrichment, index: number, value: string): QuizEnrichment {
    const selectedOption = quiz.options[index];
    return {
        ...quiz,
        options: quiz.options.map((option, optionIndex) => (optionIndex === index ? value : option)),
        correctAnswer: quiz.correctAnswer === selectedOption ? value : quiz.correctAnswer,
    };
}

export function addQuizOption(quiz: QuizEnrichment): QuizEnrichment {
    if (quiz.options.length >= 4) {
        return quiz;
    }
    return { ...quiz, options: [...quiz.options, ''] };
}

export function removeQuizOption(quiz: QuizEnrichment, index: number): QuizEnrichment {
    if (quiz.options.length <= 2) {
        return quiz;
    }
    const removedOption = quiz.options[index];
    const options = quiz.options.filter((_, optionIndex) => optionIndex !== index);
    return {
        ...quiz,
        options,
        correctAnswer: quiz.correctAnswer === removedOption ? (options[0] ?? '') : quiz.correctAnswer,
    };
}

export function QuizEnrichmentEditor(props: QuizEnrichmentEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(() => copyQuiz(props.quiz));
    const [error, setError] = useState<string | null>(null);
    const editorId = useId();
    const promptId = `${editorId}-prompt`;
    const correctAnswerId = `${editorId}-correct-answer`;
    const explanationId = `${editorId}-explanation`;
    const radioGroupName = `${editorId}-correct-answer`;

    useEffect(() => {
        if (!isEditing) {
            setDraft(copyQuiz(props.quiz));
            setError(null);
        }
    }, [isEditing, props.quiz]);

    const apply = () => {
        const parsed = QuizEnrichmentSchema.safeParse(draft);
        if (!parsed.success) {
            setError(props.labels.invalid);
            return;
        }
        props.onChange(parsed.data);
        setIsEditing(false);
    };

    const cancel = () => {
        setDraft(copyQuiz(props.quiz));
        setError(null);
        setIsEditing(false);
    };

    if (!isEditing) {
        return (
            <section className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary">{props.labels.badge}</Badge>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditing(true)}
                            disabled={props.disabled}
                        >
                            {props.labels.edit}
                        </Button>
                        {props.onRegenerate ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={props.onRegenerate}
                                disabled={props.disabled || props.isRegenerating}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                {props.labels.regenerate}
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={props.onRemove}
                            disabled={props.disabled}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {props.labels.remove}
                        </Button>
                    </div>
                </div>
                <p className="text-sm font-medium">{props.quiz.prompt}</p>
                <p className="text-xs text-muted-foreground">{props.quiz.options.join(' · ')}</p>
            </section>
        );
    }

    return (
        <section className="space-y-3 rounded-md border border-border/70 p-3">
            <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor={promptId}>
                    {props.labels.prompt}
                </label>
                <Input
                    id={promptId}
                    aria-label={props.labels.prompt}
                    value={draft.prompt}
                    onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                    disabled={props.disabled}
                />
            </div>
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{props.labels.correctAnswer}</legend>
                {draft.options.map((option, index) => (
                    <div className="flex items-center gap-2" key={`${index}-${option}`}>
                        <input
                            aria-label={`${props.labels.correctAnswer} ${index + 1}`}
                            checked={draft.correctAnswer === option}
                            disabled={props.disabled}
                            name={radioGroupName}
                            onChange={() => setDraft((current) => ({ ...current, correctAnswer: option }))}
                            type="radio"
                            value={option}
                        />
                        <Input
                            aria-label={props.labels.option(index + 1)}
                            value={option}
                            onChange={(event) => setDraft((current) => updateQuizOption(current, index, event.target.value))}
                            disabled={props.disabled}
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setDraft((current) => removeQuizOption(current, index))}
                            disabled={props.disabled || draft.options.length <= 2}
                            aria-label={`${props.labels.removeOption} ${index + 1}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft((current) => addQuizOption(current))}
                    disabled={props.disabled || draft.options.length >= 4}
                >
                    <CirclePlus className="h-3.5 w-3.5" />
                    {props.labels.addOption}
                </Button>
            </fieldset>
            <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor={correctAnswerId}>
                    {props.labels.correctAnswer}
                </label>
                <Input
                    id={correctAnswerId}
                    aria-label={props.labels.correctAnswer}
                    value={draft.correctAnswer}
                    onChange={(event) => setDraft((current) => ({ ...current, correctAnswer: event.target.value }))}
                    disabled={props.disabled}
                />
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor={explanationId}>
                    {props.labels.explanation}
                </label>
                <textarea
                    id={explanationId}
                    className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={draft.explanation}
                    onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))}
                    disabled={props.disabled}
                />
            </div>
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={apply} disabled={props.disabled}>
                    {props.labels.apply}
                </Button>
                <Button type="button" variant="outline" onClick={cancel} disabled={props.disabled}>
                    {props.labels.cancel}
                </Button>
            </div>
        </section>
    );
}
