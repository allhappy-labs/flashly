import { act, type ChangeEventHandler, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createRequire } from 'node:module';
import { errAsync, okAsync } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderTransport } from '@/config/provider-transport';
import { ImageSelectionDialog } from './image-selection-dialog';

const moduleRequire = createRequire(import.meta.url);
const { JSDOM } = moduleRequire('jsdom');

const image = {
    id: 'photo-1',
    url: 'https://images.unsplash.com/photo-1?w=640',
    thumbUrl: 'https://images.unsplash.com/photo-1?w=300',
    downloadLocation: 'https://api.unsplash.com/photos/photo-1/download',
    description: 'Alpine lake',
    author: 'Ada',
    authorUrl: 'https://unsplash.com/@ada',
};
const directTransport: ProviderTransport = 'direct';

const doubles = vi.hoisted(() => ({
    currentAccessKey: 'current-key',
    findImages: vi.fn(),
    triggerDownload: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

vi.mock('@/utils/unsplash', () => ({
    findUnsplashImages: doubles.findImages,
    normalizeUnsplashQuery: (front: string) => front,
}));

vi.mock('@/utils/unsplash-settings', () => ({
    getUnsplashSettings: () => ({
        accessKey: doubles.currentAccessKey,
    }),
}));

vi.mock('@/services/unsplash-download-service', () => ({
    getUnsplashDownloadService: () => ({
        triggerDownload: doubles.triggerDownload,
    }),
}));

vi.mock('@/components/ui/dialog', () => {
    const Region = (props: Readonly<{ children?: ReactNode }>) => (
        <div>{props.children}</div>
    );
    return {
        Dialog: (props: Readonly<{ children?: ReactNode; open: boolean }>) => (
            props.open ? <div>{props.children}</div> : null
        ),
        DialogContent: Region,
        DialogDescription: Region,
        DialogFooter: Region,
        DialogHeader: Region,
        DialogTitle: Region,
    };
});

vi.mock('@/components/ui/button', () => ({
    Button: (props: Readonly<{
        children?: ReactNode;
        disabled?: boolean;
        onClick?: () => void;
    }>) => (
        <button type="button" disabled={props.disabled} onClick={props.onClick}>
            {props.children}
        </button>
    ),
}));

vi.mock('@/components/ui/input', () => ({
    Input: (props: Readonly<{
        className?: string;
        onChange?: ChangeEventHandler<HTMLInputElement>;
        placeholder?: string;
        type?: string;
        value?: string;
    }>) => (
        <input
            className={props.className}
            onChange={props.onChange}
            placeholder={props.placeholder}
            type={props.type}
            value={props.value}
        />
    ),
}));

vi.mock('@/components/ui/image-with-loading', () => ({
    ImageWithLoading: (props: Readonly<{ alt: string; src: string }>) => (
        <img alt={props.alt} src={props.src} />
    ),
}));

type RenderOptions = Readonly<{
    onImageSelect: (imageUrl: string, downloadLocation?: string) => void;
    requestSettingsOpen: () => void;
}>;

async function renderDialog(options: RenderOptions): Promise<Readonly<{
    container: HTMLDivElement;
    root: Root;
}>> {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const dialogProps = {
        unsplashTransport: directTransport,
        unsplashAccessKey: 'stale-key',
        settingsUserId: undefined,
        requestSettingsOpen: options.requestSettingsOpen,
        open: true,
        onOpenChange: vi.fn(),
        card: {
            front: 'Alpine lake',
            back: 'A lake in the Alps',
        },
        currentImageUrl: image.url,
        onImageSelect: options.onImageSelect,
    };

    await act(async () => {
        root.render(<ImageSelectionDialog {...dialogProps} />);
    });
    await act(async () => {
        await vi.runAllTimersAsync();
    });

    return { container, root };
}

function getSearchInput(container: HTMLElement): HTMLInputElement {
    const input = container.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
        throw new Error('Search input was not rendered');
    }
    return input;
}

function getSelectButton(container: HTMLElement): HTMLButtonElement {
    const button = [...container.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'web.flashcards.imageSelection.selectButton',
    );
    if (!(button instanceof HTMLButtonElement)) {
        throw new Error('Select button was not rendered');
    }
    return button;
}

describe('ImageSelectionDialog direct settings', () => {
    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', {
            url: 'http://localhost',
        });
        vi.stubGlobal('window', dom.window);
        vi.stubGlobal('document', dom.window.document);
        vi.stubGlobal('navigator', dom.window.navigator);
        vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
        vi.stubGlobal('HTMLButtonElement', dom.window.HTMLButtonElement);
        vi.stubGlobal('HTMLInputElement', dom.window.HTMLInputElement);
        vi.stubGlobal('Event', dom.window.Event);
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        vi.useFakeTimers();
        doubles.currentAccessKey = 'current-key';
        doubles.findImages.mockImplementation(() => {
            void fetch('https://api.unsplash.com/search/photos');
            return okAsync([image]);
        });
        doubles.triggerDownload.mockReturnValue(okAsync(undefined));
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.replaceChildren();
        vi.clearAllMocks();
        doubles.findImages.mockReset();
        doubles.triggerDownload.mockReset();
        vi.unstubAllGlobals();
    });

    it('renders the dialog title from shared image-selection translation keys', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);
        const rendered = await renderDialog({
            onImageSelect: vi.fn(),
            requestSettingsOpen: vi.fn(),
        });

        expect(rendered.container.textContent).toContain('web.flashcards.imageSelection.title');
        expect(rendered.container.textContent).toContain('web.flashcards.imageSelection.onUnsplash');

        await act(async () => {
            rendered.root.unmount();
        });
    });

    it('blocks a new search when the current direct key is removed while open', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);
        const requestSettingsOpen = vi.fn();
        const rendered = await renderDialog({
            onImageSelect: vi.fn(),
            requestSettingsOpen,
        });
        expect(fetchSpy).toHaveBeenCalledOnce();

        doubles.currentAccessKey = '';
        const input = getSearchInput(rendered.container);
        await act(async () => {
            input.value = 'changed query';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(requestSettingsOpen).toHaveBeenCalledOnce();
        expect(fetchSpy).toHaveBeenCalledOnce();

        await act(async () => {
            rendered.root.unmount();
        });
    });

    it('blocks selection when the current direct key is removed before tracking', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);
        const requestSettingsOpen = vi.fn();
        const onImageSelect = vi.fn();
        const rendered = await renderDialog({
            onImageSelect,
            requestSettingsOpen,
        });
        expect(fetchSpy).toHaveBeenCalledOnce();

        doubles.currentAccessKey = '';
        await act(async () => {
            getSelectButton(rendered.container).click();
        });

        expect(requestSettingsOpen).toHaveBeenCalledOnce();
        expect(onImageSelect).not.toHaveBeenCalled();
        expect(doubles.triggerDownload).not.toHaveBeenCalled();

        await act(async () => {
            rendered.root.unmount();
        });
    });

    it('does not apply a selection when direct tracking validation fails', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);
        doubles.triggerDownload.mockReturnValue(
            errAsync(new Error('Invalid Unsplash direct download location')),
        );
        const onImageSelect = vi.fn();
        const rendered = await renderDialog({
            onImageSelect,
            requestSettingsOpen: vi.fn(),
        });

        await act(async () => {
            getSelectButton(rendered.container).click();
            await Promise.resolve();
        });

        expect(doubles.triggerDownload).toHaveBeenCalledOnce();
        expect(onImageSelect).not.toHaveBeenCalled();

        await act(async () => {
            rendered.root.unmount();
        });
    });
});
