import type { FlashcardsResponse, QuizEnrichment, SupportedLocale } from '@flashly/shared/src';

import { getStableCardId } from './flashcard-generator-utils';

export interface FlashcardsState {
    flashcards: FlashcardsResponse | null;
    streamedCards: FlashcardsResponse['flashcards'];
    generatedDecks: Array<{ locale: SupportedLocale; flashcards: FlashcardsResponse }>;
}

export type FlashcardsAction =
    | { type: 'SET_FLASHCARDS'; payload: FlashcardsResponse | null }
    | { type: 'SET_STREAMED_CARDS'; payload: FlashcardsResponse['flashcards'] }
    | { type: 'SET_GENERATED_DECKS'; payload: Array<{ locale: SupportedLocale; flashcards: FlashcardsResponse }> }
    | { type: 'UPDATE_WITH_AUDIO'; payload: FlashcardsResponse['flashcards'] }
    | { type: 'UPDATE_WITH_IMAGES'; payload: FlashcardsResponse['flashcards'] }
    | { type: 'UPDATE_CARD_FRONT_AT_INDEX'; payload: { index: number; front: string } }
    | { type: 'UPDATE_CARD_QUIZ_AT_INDEX'; payload: { index: number; quiz?: QuizEnrichment } }
    | { type: 'REMOVE_CARD_AT_INDEX'; payload: { index: number } }
    | { type: 'RESET' };

export const initialFlashcardsState: FlashcardsState = {
    flashcards: null,
    streamedCards: [],
    generatedDecks: [],
};

function mergeCardsByStableId(
    baseCards: FlashcardsResponse['flashcards'],
    updatedCards: FlashcardsResponse['flashcards'],
    field: 'audioUrl' | 'imageUrl',
) {
    return baseCards.map((card) => {
        const cardId = getStableCardId(card);
        const updatedCard = updatedCards.find((candidate) => getStableCardId(candidate) === cardId);
        if (!updatedCard) {
            return card;
        }
        return { ...card, [field]: updatedCard[field] };
    });
}

function applyMediaUpdate(
    state: FlashcardsState,
    updatedCards: FlashcardsResponse['flashcards'],
    field: 'audioUrl' | 'imageUrl',
): FlashcardsState {
    return {
        ...state,
        flashcards: state.flashcards
            ? {
                flashcards: mergeCardsByStableId(state.flashcards.flashcards, updatedCards, field),
            }
            : state.flashcards,
        streamedCards: mergeCardsByStableId(state.streamedCards, updatedCards, field),
        generatedDecks: state.generatedDecks.map((deck) => ({
            locale: deck.locale,
            flashcards: {
                flashcards: mergeCardsByStableId(deck.flashcards.flashcards, updatedCards, field),
            },
        })),
    };
}

function updateCardFrontAtIndex(
    cards: FlashcardsResponse['flashcards'],
    index: number,
    front: string,
): FlashcardsResponse['flashcards'] {
    if (index < 0 || index >= cards.length) {
        return cards;
    }
    if (cards[index]?.front === front) {
        return cards;
    }
    return cards.map((card, cardIndex) => {
        if (cardIndex !== index) {
            return card;
        }
        return { ...card, front };
    });
}

function removeCardAtIndex(cards: FlashcardsResponse['flashcards'], index: number): FlashcardsResponse['flashcards'] {
    if (index < 0 || index >= cards.length) {
        return cards;
    }
    return cards.filter((_, cardIndex) => cardIndex !== index);
}

function updateCardQuizAtIndex(
    cards: FlashcardsResponse['flashcards'],
    index: number,
    quiz: QuizEnrichment | undefined,
): FlashcardsResponse['flashcards'] {
    if (index < 0 || index >= cards.length) {
        return cards;
    }
    return cards.map((card, cardIndex) => (cardIndex === index ? { ...card, quiz } : card));
}

function applyQuizUpdate(state: FlashcardsState, index: number, quiz: QuizEnrichment | undefined): FlashcardsState {
    return {
        ...state,
        flashcards: state.flashcards
            ? { flashcards: updateCardQuizAtIndex(state.flashcards.flashcards, index, quiz) }
            : state.flashcards,
        streamedCards: updateCardQuizAtIndex(state.streamedCards, index, quiz),
        generatedDecks: state.generatedDecks.map((deck) => ({
            locale: deck.locale,
            flashcards: { flashcards: updateCardQuizAtIndex(deck.flashcards.flashcards, index, quiz) },
        })),
    };
}

function applyFrontUpdate(state: FlashcardsState, index: number, front: string): FlashcardsState {
    return {
        ...state,
        flashcards: state.flashcards
            ? {
                flashcards: updateCardFrontAtIndex(state.flashcards.flashcards, index, front),
            }
            : state.flashcards,
        streamedCards: updateCardFrontAtIndex(state.streamedCards, index, front),
        generatedDecks: state.generatedDecks.map((deck) => ({
            locale: deck.locale,
            flashcards: {
                flashcards: updateCardFrontAtIndex(deck.flashcards.flashcards, index, front),
            },
        })),
    };
}

function applyCardRemove(state: FlashcardsState, index: number): FlashcardsState {
    return {
        ...state,
        flashcards: state.flashcards
            ? {
                flashcards: removeCardAtIndex(state.flashcards.flashcards, index),
            }
            : state.flashcards,
        streamedCards: removeCardAtIndex(state.streamedCards, index),
        generatedDecks: state.generatedDecks.map((deck) => ({
            locale: deck.locale,
            flashcards: {
                flashcards: removeCardAtIndex(deck.flashcards.flashcards, index),
            },
        })),
    };
}

export function flashcardsReducer(state: FlashcardsState, action: FlashcardsAction): FlashcardsState {
    switch (action.type) {
        case 'SET_FLASHCARDS':
            return { ...state, flashcards: action.payload };
        case 'SET_STREAMED_CARDS':
            return { ...state, streamedCards: action.payload };
        case 'SET_GENERATED_DECKS':
            return { ...state, generatedDecks: action.payload };
        case 'UPDATE_WITH_AUDIO':
            return applyMediaUpdate(state, action.payload, 'audioUrl');
        case 'UPDATE_WITH_IMAGES':
            return applyMediaUpdate(state, action.payload, 'imageUrl');
        case 'UPDATE_CARD_FRONT_AT_INDEX':
            return applyFrontUpdate(state, action.payload.index, action.payload.front);
        case 'UPDATE_CARD_QUIZ_AT_INDEX':
            return applyQuizUpdate(state, action.payload.index, action.payload.quiz);
        case 'REMOVE_CARD_AT_INDEX':
            return applyCardRemove(state, action.payload.index);
        case 'RESET':
            return initialFlashcardsState;
        default:
            return state;
    }
}
