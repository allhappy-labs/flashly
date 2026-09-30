import JSZip from 'jszip';
import {
    EXPORT_CONFIG_FILE_NAME,
    EXPORT_FORMAT_VERSION,
    normalizeQuizEnrichment,
    type ExportConfig,
    type QuizEnrichment,
} from '@flashly/shared/src';

const BASE_LOCALE = 'eng';

export interface DeckDownloadCard {
    front: string;
    back: string;
    imageUrl?: string | null;
    imagePath?: string | null;
    audioUrl?: string | null;
    audioPath?: string | null;
    category?: string | null;
    pos?: string | null;
    gender?: string | null;
    example?: unknown;
    tags?: string[] | string | null;
    quiz?: QuizEnrichment | null;
}

export interface DownloadDeckAsFlashlyInput {
    deckName: string;
    cards: DeckDownloadCard[];
    locale?: string | null;
    description?: string | null;
    materialType?: string | null;
    deckType?: string | null;
}

function sanitizeFileName(name: string) {
    const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const safe = normalized
        .replace(/[^a-z0-9\-_]+/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return safe || 'deck';
}

function sanitizeSlug(value: string) {
    const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const safe = normalized
        .replace(/[^a-z0-9\-_]+/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return safe || 'card';
}

function getUniqueId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTags(tags: DeckDownloadCard['tags']) {
    if (Array.isArray(tags)) {
        const parsed = tags.map((tag) => tag.trim()).filter(Boolean);
        return parsed.length > 0 ? parsed : undefined;
    }
    if (typeof tags === 'string') {
        const parsed = tags
            .split(/[;,]/)
            .map((tag) => tag.trim())
            .filter(Boolean);
        return parsed.length > 0 ? parsed : undefined;
    }
    return undefined;
}

export function buildDeckJsonl(
    cards: DeckDownloadCard[],
    audioPathByUrl: Map<string, string>,
    imagePathByUrl: Map<string, string>,
) {
    return cards
        .map((card) => {
            const rawAudioUrl = typeof card.audioUrl === 'string' ? card.audioUrl.trim() : '';
            const mappedAudioPath = rawAudioUrl ? audioPathByUrl.get(rawAudioUrl) : undefined;
            const audioPath = mappedAudioPath || card.audioPath;
            const audioUrl = audioPath ? '' : rawAudioUrl;

            const rawImageUrl = typeof card.imageUrl === 'string' ? card.imageUrl.trim() : '';
            const mappedImagePath = rawImageUrl ? imagePathByUrl.get(rawImageUrl) : undefined;
            const imagePath = mappedImagePath || card.imagePath;
            const imageUrl = imagePath ? '' : rawImageUrl;

            return JSON.stringify({
                front: card.front,
                back: card.back,
                imageUrl: imageUrl || undefined,
                imagePath: imagePath || undefined,
                audioUrl: audioUrl || undefined,
                audioPath: audioPath || undefined,
                category: card.category ?? undefined,
                pos: card.pos ?? undefined,
                gender: card.gender ?? undefined,
                example: card.example ?? undefined,
                tags: normalizeTags(card.tags),
                quiz: normalizeQuizEnrichment(card.quiz),
            });
        })
        .join('\n');
}

export async function downloadDeckAsFlashly(input: DownloadDeckAsFlashlyInput): Promise<void> {
    if (!input.cards.length) {
        throw new Error('No cards to download');
    }

    const zip = new JSZip();
    const audioPathByUrl = new Map<string, string>();
    const audioEntries: Array<{ path: string; base64: string }> = [];
    const imagePathByUrl = new Map<string, string>();
    const imageEntries: Array<{ path: string; base64: string }> = [];
    const usedPaths = new Set<string>();

    const ensureUniqueZipPath = (desired: string) => {
        if (!usedPaths.has(desired)) {
            usedPaths.add(desired);
            return desired;
        }
        const match = desired.match(/^(.*?)(\.[a-z0-9]+)?$/i);
        const base = match?.[1] ?? desired;
        const ext = match?.[2] ?? '';
        let counter = 1;
        let next = `${base}-${counter}${ext}`;
        while (usedPaths.has(next) && counter < 200) {
            counter += 1;
            next = `${base}-${counter}${ext}`;
        }
        usedPaths.add(next);
        return next;
    };

    const registerAudioData = (audioUrl: string, base64: string, extension: string, nameBase: string) => {
        if (audioPathByUrl.has(audioUrl)) return;
        const zipPath = ensureUniqueZipPath(`media/audio/${nameBase}-${getUniqueId()}${extension}`);
        audioPathByUrl.set(audioUrl, zipPath);
        audioEntries.push({ path: zipPath, base64 });
    };

    const registerImageData = (imageUrl: string, base64: string, extension: string, nameBase: string) => {
        if (imagePathByUrl.has(imageUrl)) return;
        const zipPath = ensureUniqueZipPath(`media/images/${nameBase}-${getUniqueId()}${extension}`);
        imagePathByUrl.set(imageUrl, zipPath);
        imageEntries.push({ path: zipPath, base64 });
    };

    input.cards.forEach((card, index) => {
        const rawAudioUrl = typeof card.audioUrl === 'string' ? card.audioUrl.trim() : '';
        if (!rawAudioUrl || !rawAudioUrl.startsWith('data:audio/')) return;
        const match = rawAudioUrl.match(/^data:audio\/([a-z0-9+.-]+);base64,(.*)$/i);
        if (!match) return;
        const extension = `.${match[1].replace('mpeg', 'mp3')}`;
        const nameBase = sanitizeSlug(card.front || card.back || `card-${index + 1}`);
        registerAudioData(rawAudioUrl, match[2], extension, nameBase);
    });

    input.cards.forEach((card, index) => {
        const rawImageUrl = typeof card.imageUrl === 'string' ? card.imageUrl.trim() : '';
        if (!rawImageUrl || !rawImageUrl.startsWith('data:image/')) return;
        const match = rawImageUrl.match(/^data:image\/([a-z0-9+.-]+);base64,(.*)$/i);
        if (!match) return;
        const extension = `.${match[1].replace('jpeg', 'jpg')}`;
        const nameBase = sanitizeSlug(card.front || card.back || `card-${index + 1}`);
        registerImageData(rawImageUrl, match[2], extension, nameBase);
    });

    const resolvedDeckName = input.deckName.trim() || 'Generated deck';
    const localeSuffix = input.locale || BASE_LOCALE;

    const exportConfig: ExportConfig = {
        version: EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        deck: {
            name: resolvedDeckName,
            description: input.description ?? null,
            locale: localeSuffix,
            materialType: input.materialType ?? undefined,
            deckType: input.deckType ?? undefined,
        },
        cardCount: input.cards.length,
        app: {
            name: 'Flashly',
            platform: 'web',
        },
    };

    zip.file(EXPORT_CONFIG_FILE_NAME, JSON.stringify(exportConfig, null, 2));
    zip.file('deck.jsonl', buildDeckJsonl(input.cards, audioPathByUrl, imagePathByUrl));

    audioEntries.forEach((entry) => {
        zip.file(entry.path, entry.base64, { base64: true });
    });

    imageEntries.forEach((entry) => {
        zip.file(entry.path, entry.base64, { base64: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const safeName = sanitizeFileName(resolvedDeckName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}-${localeSuffix}.flashly`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
