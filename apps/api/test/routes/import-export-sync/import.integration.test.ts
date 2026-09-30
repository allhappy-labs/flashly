import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { assertSuccess, assertStatus, assertBodyHasKeys } from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('import routes - import deck from Flashly format', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'flashly-import');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Imported Flashly Deck',
                description: 'Imported from Flashly format',
                materialType: 'language',
                deckType: 'vocabulary',
                locale: 'en',
            },
            cards: [
                { front: 'Hello', back: 'Konnichiwa' },
                { front: 'Goodbye', back: 'Sayonara' },
                { front: 'Thank you', back: 'Arigatou' },
            ],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['deckId', 'name', 'cardCount']);
    assert.equal(body.name, 'Imported Flashly Deck');
    assert.equal(body.cardCount, 3);
});

test('import routes - import requires authentication', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        payload: {
            deck: { name: 'Test Deck' },
            cards: [{ front: 'Test', back: 'Test' }],
        },
    });

    assertStatus(response, 401);
});

test('import routes - import Flashly with all optional fields', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'full-import');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Full Feature Deck',
                description: 'A complete deck',
                materialType: 'language',
                deckType: 'vocabulary',
                locale: 'ja',
                accentKey: 'tokyo',
            },
            cards: [
                {
                    front: 'Test',
                    back: 'テスト',
                    imageUrl: 'https://example.com/image.jpg',
                    audioUrl: 'https://example.com/audio.mp3',
                    category: 'noun',
                    pos: 'noun',
                    gender: 'neuter',
                    example: 'This is an example.',
                    tags: 'basic,test,vocabulary',
                },
            ],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.cardCount, 1);
});

test('import routes - import Flashly with minimal data', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'minimal-import');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Minimal Deck',
            },
            cards: [
                { front: 'A', back: 'B' },
            ],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.cardCount, 1);
});

test('import routes - import Flashly validates deck name', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'invalid-name');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: '', // Invalid - empty name
            },
            cards: [{ front: 'Test', back: 'Test' }],
        },
    });

    assertStatus(response, 400);
});

test('import routes - import Flashly requires at least one card', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'no-cards');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Empty Card Deck',
            },
            cards: [],
        },
    });

    assertStatus(response, 400);
});

test('import routes - import Anki CSV format', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'anki-import');

    const csvContent = 'Front, Back\nHello,Konnichiwa\nGoodbye,Sayonara\n';

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/anki-csv',
        headers: user.headers,
        payload: {
            csv: csvContent,
            deckName: 'Anki Imported Deck',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['deckId', 'name', 'cardCount']);
    assert.equal(body.name, 'Anki Imported Deck');
    assert.ok(body.cardCount >= 2);
});

test('import routes - import Anki CSV generates deck name', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'auto-name');

    const csvContent = 'Front, Back\nTest,Test\n';

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/anki-csv',
        headers: user.headers,
        payload: {
            csv: csvContent,
            // No deckName provided
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(typeof body.name === 'string');
    assert.ok(body.name.length > 0);
});

test('import routes - import Anki CSV requires CSV content', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'no-csv');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/anki-csv',
        headers: user.headers,
        payload: {
            csv: '',
        },
    });

    assertStatus(response, 400);
});

test('import routes - import Quizlet text format', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'quizlet-import');

    const quizletContent = 'Hello\tKonnichiwa\nGoodbye\tSayonara\nThank you\tArigatou\n';

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/quizlet',
        headers: user.headers,
        payload: {
            content: quizletContent,
            deckName: 'Quizlet Imported Deck',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['deckId', 'name', 'cardCount']);
    assert.equal(body.name, 'Quizlet Imported Deck');
    assert.ok(body.cardCount >= 3);
});

test('import routes - import Quizlet handles different line endings', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'line-endings');

    // Mix of \n and \r\n
    const quizletContent = 'One\t一\r\nTwo\t二\nThree\t三\r\n';

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/quizlet',
        headers: user.headers,
        payload: {
            content: quizletContent,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(body.cardCount >= 3);
});

test('import routes - import Quizlet requires content', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'no-quizlet');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/quizlet',
        headers: user.headers,
        payload: {
            content: '',
        },
    });

    assertStatus(response, 400);
});

test('import routes - import handles special characters', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'special-import');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Deck with 特殊 characters and エモジー 🎴',
            },
            cards: [
                { front: 'Front with "quotes"', back: 'Back with \'apostrophes\'' },
                { front: 'カタカナ', back: 'ひらがな' },
            ],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.cardCount, 2);
});

test('import routes - import creates private deck by default', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'private-default');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Private Imported Deck',
            },
            cards: [{ front: 'Test', back: 'Test' }],
        },
    });

    assertSuccess(response);

    // Verify deck was created and is accessible
    const body = JSON.parse(response.body);
    const deckResponse = await app.inject({
        method: 'GET',
        url: `/api/decks/${body.deckId}`,
        headers: user.headers,
    });

    assertSuccess(deckResponse);
    const deck = JSON.parse(deckResponse.body);
    // Should be private by default
    assert.ok(deck.visibility === 'private' || !deck.visibility);
});

test('import routes - import large number of cards', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'large-import');

    const cards = Array.from({ length: 100 }, (_, i) => ({
        front: `Card ${i + 1}`,
        back: `Answer ${i + 1}`,
    }));

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Large Deck',
            },
            cards,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.cardCount, 100);
});

test('import routes - import handles cards with images and audio', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'media-import');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/flashly',
        headers: user.headers,
        payload: {
            deck: {
                name: 'Media Rich Deck',
            },
            cards: [
                {
                    front: 'Image Card',
                    back: 'With image',
                    imageUrl: 'https://example.com/image.jpg',
                },
                {
                    front: 'Audio Card',
                    back: 'With audio',
                    audioUrl: 'https://example.com/audio.mp3',
                },
            ],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.cardCount, 2);
});

test('import routes - Anki CSV handles quoted fields', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'quoted-csv');

    // CSV with quoted fields containing commas
    const csvContent = '"Front, with comma","Back, with comma"\n"Another ""quoted"" field","Normal field"\n';

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/anki-csv',
        headers: user.headers,
        payload: {
            csv: csvContent,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(body.cardCount >= 2);
});

test('import routes - Quizlet handles spaces in tabs', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'spaced-quizlet');

    // Some Quizlet exports use multiple spaces or tabs
    const quizletContent = 'Word one    Definition one\nWord two\tDefinition two\n';

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/import/quizlet',
        headers: user.headers,
        payload: {
            content: quizletContent,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(body.cardCount >= 2);
});
