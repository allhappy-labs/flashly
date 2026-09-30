import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { cn } from '@/utils/style-utils';

const CLOZE_REGEX = /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/gi;
const CLOZE_HIGHLIGHT_CLASS = 'rounded bg-primary/15 px-1 text-primary';
const MARKDOWN_SCHEMA = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), 'mark'],
    attributes: {
        ...defaultSchema.attributes,
        mark: ['className'],
    },
};

type MarkdownContentProps = Readonly<{
    value: string;
    className?: string;
    cloze?: boolean;
}>;

type MarkdownElementProps<T extends keyof React.JSX.IntrinsicElements> = React.ComponentPropsWithoutRef<T> & {
    node?: unknown;
};

type MarkdownCodeProps = MarkdownElementProps<'code'> & {
    inline?: boolean;
};

function applyClozeHighlight(value: string) {
    return value.replace(CLOZE_REGEX, (_match, answer) => {
        const safeAnswer = escapeHtml(String(answer ?? ''));
        return `<mark class="${CLOZE_HIGHLIGHT_CLASS}">${safeAnswer}</mark>`;
    });
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function MarkdownParagraph(props: MarkdownElementProps<'p'>) {
    return <p className={cn('whitespace-pre-wrap leading-relaxed', props.className)} {...props} />;
}

function MarkdownList(props: MarkdownElementProps<'ul'>) {
    return <ul className={cn('ml-5 list-disc space-y-1', props.className)} {...props} />;
}

function MarkdownOrderedList(props: MarkdownElementProps<'ol'>) {
    return <ol className={cn('ml-5 list-decimal space-y-1', props.className)} {...props} />;
}

function MarkdownListItem(props: MarkdownElementProps<'li'>) {
    return <li className={cn('whitespace-pre-wrap', props.className)} {...props} />;
}

function MarkdownInlineCode(props: MarkdownCodeProps) {
    return <code className={cn('rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]', props.className)} {...props} />;
}

function MarkdownPre(props: MarkdownElementProps<'pre'>) {
    return <pre className={cn('overflow-x-auto rounded bg-muted p-3 text-sm', props.className)} {...props} />;
}

function MarkdownLink(props: MarkdownElementProps<'a'>) {
    return <a className={cn('text-primary underline-offset-4 hover:underline', props.className)} {...props} />;
}

function MarkdownStrong(props: MarkdownElementProps<'strong'>) {
    return <strong className={cn('font-semibold', props.className)} {...props} />;
}

export function MarkdownContent(props: MarkdownContentProps) {
    const content = useMemo(() => {
        if (!props.cloze) return props.value;
        return applyClozeHighlight(props.value);
    }, [props.cloze, props.value]);

    return (
        <div className={cn('space-y-2 break-words', props.className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, MARKDOWN_SCHEMA]]}
                components={{
                    p: MarkdownParagraph,
                    ul: MarkdownList,
                    ol: MarkdownOrderedList,
                    li: MarkdownListItem,
                    code: MarkdownInlineCode,
                    pre: MarkdownPre,
                    a: MarkdownLink,
                    strong: MarkdownStrong,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
