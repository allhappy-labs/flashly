import { extname } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { PDFParse } from 'pdf-parse';
import removeMarkdown from 'remove-markdown';
import type { ResultAsync } from 'neverthrow';
import { ValidationError, safeAsync } from '@flashly/shared';

export type ExtractedFileType = 'pdf' | 'markdown' | 'text';

export interface ExtractedText {
    text: string;
    type: ExtractedFileType;
    pageCount?: number;
}

type TextExtractionCode =
    | 'UNSUPPORTED_FILE_TYPE'
    | 'UNSUPPORTED_FILE_SIGNATURE'
    | 'FILE_TYPE_MISMATCH'
    | 'UNSUPPORTED_FILE_CONTENT';

export class TextExtractionError extends Error {
    readonly code: TextExtractionCode;
    readonly statusCode: number;

    constructor(message: string, code: TextExtractionCode, statusCode: number) {
        super(message);
        this.name = 'TextExtractionError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);
const PDF_EXTENSIONS = new Set(['.pdf']);

function getExtension(filename?: string): string {
    return filename ? extname(filename).toLowerCase() : '';
}

function stripFrontMatter(markdown: string): string {
    return markdown.replace(/^---[\s\S]*?---\s*/u, '');
}

function stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, ' ');
}

function normalizeText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function isLikelyText(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, Math.min(buffer.length, 10000));
    let nonPrintable = 0;

    for (const byte of sample) {
        if (byte === 0) {
            return false;
        }
        if (byte < 9 || (byte > 13 && byte < 32)) {
            nonPrintable += 1;
        }
    }

    return sample.length === 0 || nonPrintable / sample.length < 0.3;
}

async function extractTextFromUploadImpl(
    buffer: Buffer,
    filename?: string,
    _mimetype?: string,
): Promise<ExtractedText> {
    const extension = getExtension(filename);
    const isTextExtension = TEXT_EXTENSIONS.has(extension);
    const isPdfExtension = PDF_EXTENSIONS.has(extension);

    if (!isTextExtension && !isPdfExtension) {
        throw new TextExtractionError(
            'Unsupported file type. Only .txt, .md, and .pdf files are allowed.',
            'UNSUPPORTED_FILE_TYPE',
            415
        );
    }

    const signature = await fileTypeFromBuffer(buffer);

    if (signature && signature.mime !== 'application/pdf') {
        throw new TextExtractionError(
            `Unsupported file signature: ${signature.mime}`,
            'UNSUPPORTED_FILE_SIGNATURE',
            415
        );
    }

    if (isPdfExtension) {
        if (!signature || signature.mime !== 'application/pdf') {
            throw new TextExtractionError(
                'File extension indicates PDF, but the file content is not a valid PDF.',
                'FILE_TYPE_MISMATCH',
                415
            );
        }

        const parser = new PDFParse({ data: buffer });
        try {
            const pdfData = await parser.getText();
            const text = normalizeText(pdfData.text);

            return {
                pageCount: pdfData.total,
                text,
                type: 'pdf',
            };
        } finally {
            await parser.destroy();
        }
    }

    if (signature) {
        throw new TextExtractionError(
            'File signature indicates a binary format not supported for text extraction.',
            'UNSUPPORTED_FILE_SIGNATURE',
            415
        );
    }

    if (!isLikelyText(buffer)) {
        throw new TextExtractionError(
            'File content does not appear to be plain text or Markdown.',
            'UNSUPPORTED_FILE_CONTENT',
            415
        );
    }

    let text = buffer.toString('utf8');

    if (extension === '.md' || extension === '.markdown') {
        text = removeMarkdown(stripHtmlTags(stripFrontMatter(text)));
        return { text: normalizeText(text), type: 'markdown' };
    }

    return { text: normalizeText(text), type: 'text' };
}

export function extractTextFromUpload(
    buffer: Buffer,
    filename?: string,
    _mimetype?: string,
): ResultAsync<ExtractedText, ValidationError> {
    return safeAsync(
        extractTextFromUploadImpl(buffer, filename, _mimetype),
        (error) => {
            if (error instanceof TextExtractionError) {
                return new ValidationError(error.message, {
                    cause: error,
                    context: { code: error.code, statusCode: error.statusCode }
                });
            }
            return new ValidationError(
                error instanceof Error ? error.message : 'Failed to extract text',
                { cause: error }
            );
        }
    );
}
