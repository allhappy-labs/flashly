import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../helper.ts';
import { createAuthenticatedUser } from '../utils/auth-factory.ts';
import { isDatabaseAvailable } from '../utils/database-helpers.ts';

test('decks/card routes support CRUD and bulk operations', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const auth = await createAuthenticatedUser(app, 'deck-crud');

    const createDeckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: auth.headers,
        payload: {
            name: 'Integration Deck CRUD',
            visibility: 'private',
        },
    });

    assert.equal(createDeckResponse.statusCode, 200);
    const createdDeck = JSON.parse(createDeckResponse.body);
    assert.equal(typeof createdDeck.id, 'string');

    const listDecksResponse = await app.inject({
        method: 'GET',
        url: '/api/decks?page=1&limit=10',
        headers: auth.headers,
    });

    assert.equal(listDecksResponse.statusCode, 200);
    const listedDecks = JSON.parse(listDecksResponse.body);
    assert.equal(Array.isArray(listedDecks.items), true);
    assert.equal(listedDecks.items.length >= 1, true);

    const createCardResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards`,
        headers: auth.headers,
        payload: {
            front: 'Alpha',
            back: 'A',
        },
    });

    assert.equal(createCardResponse.statusCode, 200);
    const createdCard = JSON.parse(createCardResponse.body);
    assert.equal(typeof createdCard.id, 'string');

    const updateCardResponse = await app.inject({
        method: 'PUT',
        url: `/api/decks/${createdDeck.id}/cards/${createdCard.id}`,
        headers: auth.headers,
        payload: {
            front: 'Alpha Updated',
        },
    });

    assert.equal(updateCardResponse.statusCode, 200);
    const updatedCard = JSON.parse(updateCardResponse.body);
    assert.equal(updatedCard.front, 'Alpha Updated');

    const bulkCreateCardsResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards`,
        headers: auth.headers,
        payload: {
            cards: [
                {
                    front: 'Beta',
                    back: 'B',
                },
                {
                    front: 'alpha updated',
                    back: 'duplicate should skip',
                },
            ],
        },
    });

    assert.equal(bulkCreateCardsResponse.statusCode, 200);
    const bulkCreateResult = JSON.parse(bulkCreateCardsResponse.body);
    assert.equal(bulkCreateResult.count, 1);
    assert.equal(bulkCreateResult.skippedDuplicates, 1);

    const deckAfterBulkCreateResponse = await app.inject({
        method: 'GET',
        url: `/api/decks/${createdDeck.id}`,
        headers: auth.headers,
    });

    assert.equal(deckAfterBulkCreateResponse.statusCode, 200);
    const deckAfterBulkCreate = JSON.parse(deckAfterBulkCreateResponse.body);
    assert.equal(Array.isArray(deckAfterBulkCreate.cards), true);
    assert.equal(deckAfterBulkCreate.cards.length, 2);

    const betaCard = deckAfterBulkCreate.cards.find((card: { front: string }) => card.front === 'Beta');
    assert.equal(typeof betaCard?.id, 'string');

    const bulkUpdateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards/bulk/update`,
        headers: auth.headers,
        payload: {
            cardIds: [createdCard.id, betaCard.id],
            category: 'letters',
            tags: 'alpha,beta',
        },
    });

    assert.equal(bulkUpdateResponse.statusCode, 200);
    const bulkUpdateResult = JSON.parse(bulkUpdateResponse.body);
    assert.equal(bulkUpdateResult.count, 2);

    const bulkQuizUpdateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards/bulk/quiz`,
        headers: auth.headers,
        payload: {
            updates: [{
                cardId: createdCard.id,
                quiz: {
                    prompt: 'Which article belongs to Vater?',
                    options: ['der', 'die', 'das'],
                    correctAnswer: 'der',
                    explanation: 'Vater is masculine.',
                },
            }],
        },
    });

    assert.equal(bulkQuizUpdateResponse.statusCode, 200);
    assert.deepEqual(bulkQuizUpdateResponse.json(), { count: 1 });

    const deckAfterQuizUpdateResponse = await app.inject({
        method: 'GET',
        url: `/api/decks/${createdDeck.id}`,
        headers: auth.headers,
    });

    assert.equal(deckAfterQuizUpdateResponse.statusCode, 200);
    const deckAfterQuizUpdate = deckAfterQuizUpdateResponse.json();
    const quizUpdatedCard = deckAfterQuizUpdate.cards.find((card: {
        id: string;
        front: string;
        back: string;
        quiz: unknown;
    }) => card.id === createdCard.id);
    assert.equal(quizUpdatedCard?.front, 'Alpha Updated');
    assert.equal(quizUpdatedCard?.back, 'A');
    assert.deepEqual(quizUpdatedCard?.quiz, {
        prompt: 'Which article belongs to Vater?',
        options: ['der', 'die', 'das'],
        correctAnswer: 'der',
        explanation: 'Vater is masculine.',
    });

    const clearQuizUpdateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards/bulk/quiz`,
        headers: auth.headers,
        payload: {
            updates: [{
                cardId: createdCard.id,
                quiz: null,
            }],
        },
    });

    assert.equal(clearQuizUpdateResponse.statusCode, 200);
    assert.deepEqual(clearQuizUpdateResponse.json(), { count: 1 });

    const deckAfterQuizClearResponse = await app.inject({
        method: 'GET',
        url: `/api/decks/${createdDeck.id}`,
        headers: auth.headers,
    });

    assert.equal(deckAfterQuizClearResponse.statusCode, 200);
    const deckAfterQuizClear = deckAfterQuizClearResponse.json();
    const quizClearedCard = deckAfterQuizClear.cards.find((card: {
        id: string;
        front: string;
        back: string;
        quiz: unknown;
    }) => card.id === createdCard.id);
    assert.equal(quizClearedCard?.front, 'Alpha Updated');
    assert.equal(quizClearedCard?.back, 'A');
    assert.strictEqual(quizClearedCard?.quiz, null);

    const invalidQuizUpdateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards/bulk/quiz`,
        headers: auth.headers,
        payload: {
            updates: [{
                cardId: createdCard.id,
                quiz: {
                    prompt: 'Which article belongs to Vater?',
                    options: ['der', 'der'],
                    correctAnswer: 'der',
                    explanation: 'Vater is masculine.',
                },
            }],
        },
    });

    assert.equal(invalidQuizUpdateResponse.statusCode, 400);

    const secondDeckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: auth.headers,
        payload: {
            name: 'Other Integration Deck',
            visibility: 'private',
        },
    });

    assert.equal(secondDeckResponse.statusCode, 200);
    const secondDeck = secondDeckResponse.json();

    const secondCardResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${secondDeck.id}/cards`,
        headers: auth.headers,
        payload: {
            front: 'Gamma',
            back: 'G',
        },
    });

    assert.equal(secondCardResponse.statusCode, 200);
    const secondCard = secondCardResponse.json();

    const mixedDeckQuizUpdateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards/bulk/quiz`,
        headers: auth.headers,
        payload: {
            updates: [{
                cardId: createdCard.id,
                quiz: {
                    prompt: 'Which article belongs to Vater?',
                    options: ['der', 'die', 'das'],
                    correctAnswer: 'der',
                    explanation: 'Vater is masculine.',
                },
            }, {
                cardId: secondCard.id,
                quiz: null,
            }],
        },
    });

    assert.equal(mixedDeckQuizUpdateResponse.statusCode, 400);

    const deckAfterMixedDeckRejectionResponse = await app.inject({
        method: 'GET',
        url: `/api/decks/${createdDeck.id}`,
        headers: auth.headers,
    });

    assert.equal(deckAfterMixedDeckRejectionResponse.statusCode, 200);
    const deckAfterMixedDeckRejection = deckAfterMixedDeckRejectionResponse.json();
    const unmodifiedCard = deckAfterMixedDeckRejection.cards.find((card: {
        id: string;
        quiz: unknown;
    }) => card.id === createdCard.id);
    assert.strictEqual(unmodifiedCard?.quiz, null);

    const bulkDeleteResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${createdDeck.id}/cards/bulk/delete`,
        headers: auth.headers,
        payload: {
            cardIds: [createdCard.id, betaCard.id],
        },
    });

    assert.equal(bulkDeleteResponse.statusCode, 200);
    const bulkDeleteResult = JSON.parse(bulkDeleteResponse.body);
    assert.equal(bulkDeleteResult.count, 2);

    const deckAfterDeleteResponse = await app.inject({
        method: 'GET',
        url: `/api/decks/${createdDeck.id}`,
        headers: auth.headers,
    });

    assert.equal(deckAfterDeleteResponse.statusCode, 200);
    const deckAfterDelete = JSON.parse(deckAfterDeleteResponse.body);
    assert.equal(deckAfterDelete.cards.length, 0);

    const deleteDeckResponse = await app.inject({
        method: 'DELETE',
        url: `/api/decks/${createdDeck.id}`,
        headers: auth.headers,
    });

    assert.equal(deleteDeckResponse.statusCode, 204);
});

test('marketplace clone and sync routes include cloned deck changes', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const ownerAuth = await createAuthenticatedUser(app, 'market-owner');
    const clonerAuth = await createAuthenticatedUser(app, 'market-cloner');

    const ownerDeckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: ownerAuth.headers,
        payload: {
            name: 'Marketplace Integration Deck',
            visibility: 'public',
        },
    });

    assert.equal(ownerDeckResponse.statusCode, 200);
    const ownerDeck = JSON.parse(ownerDeckResponse.body);

    const ownerCardResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${ownerDeck.id}/cards`,
        headers: ownerAuth.headers,
        payload: {
            front: 'Market Front',
            back: 'Market Back',
        },
    });

    assert.equal(ownerCardResponse.statusCode, 200);

    const marketplaceListResponse = await app.inject({
        method: 'GET',
        url: '/api/marketplace?page=1&limit=20',
        headers: clonerAuth.headers,
    });

    assert.equal(marketplaceListResponse.statusCode, 200);
    const marketplaceList = JSON.parse(marketplaceListResponse.body);
    const listedDeck = marketplaceList.items.find((deck: { id: string }) => deck.id === ownerDeck.id);
    assert.equal(typeof listedDeck?.id, 'string');

    const cloneResponse = await app.inject({
        method: 'POST',
        url: `/api/marketplace/${ownerDeck.id}/clone`,
        headers: clonerAuth.headers,
    });

    assert.equal(cloneResponse.statusCode, 200);
    const clonedDeck = JSON.parse(cloneResponse.body);
    assert.equal(clonedDeck.userId, clonerAuth.userId);
    assert.equal(clonedDeck.visibility, 'private');
    assert.equal(clonedDeck.id !== ownerDeck.id, true);
    assert.equal(Array.isArray(clonedDeck.cards), true);
    assert.equal(clonedDeck.cards.length, 1);

    const cloneAgainResponse = await app.inject({
        method: 'POST',
        url: `/api/marketplace/${ownerDeck.id}/clone`,
        headers: clonerAuth.headers,
    });

    assert.equal(cloneAgainResponse.statusCode, 200);
    const cloneAgainDeck = JSON.parse(cloneAgainResponse.body);
    assert.equal(cloneAgainDeck.id, clonedDeck.id);

    const syncStateResponse = await app.inject({
        method: 'GET',
        url: '/api/sync/state',
        headers: clonerAuth.headers,
    });

    assert.equal(syncStateResponse.statusCode, 200);
    const syncState = JSON.parse(syncStateResponse.body);
    assert.equal(syncState.userId, clonerAuth.userId);

    const incrementalSyncResponse = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: clonerAuth.headers,
        payload: {
            cursor: '0',
            limit: 100,
        },
    });

    assert.equal(incrementalSyncResponse.statusCode, 200);
    const incrementalSync = JSON.parse(incrementalSyncResponse.body);
    assert.equal(incrementalSync.success, true);
    assert.equal(Array.isArray(incrementalSync.changes), true);
    const cloneDeckChange = incrementalSync.changes.find(
        (change: { entityType: string; entityId: string }) =>
            change.entityType === 'deck' && change.entityId === clonedDeck.id
    );
    assert.equal(typeof cloneDeckChange?.entityId, 'string');
});
