import type { Card as FsrsCard} from "ts-fsrs";
import { FSRS, Rating, State, createEmptyCard, type ReviewLog, type Grade, type FSRSParameters } from "ts-fsrs";
import type { Card, FsrsState } from "../types/models";

const fsrs = new FSRS({ maximum_interval: 365 });

function toStateEnum(state: FsrsState | State): State {
  if (typeof state === "number") return state;
  switch (state) {
    case "new":
      return State.New;
    case "learning":
      return State.Learning;
    case "relearning":
      return State.Relearning;
    case "review":
    default:
      return State.Review;
  }
}

export function fromStateEnum(state: State): FsrsState {
  switch (state) {
    case State.New:
      return "new";
    case State.Learning:
      return "learning";
    case State.Relearning:
      return "relearning";
    case State.Review:
    default:
      return "review";
  }
}

export function buildFsrsDefaults(now: number = Date.now()): Pick<
  Card,
  | "due"
  | "stability"
  | "difficulty"
  | "elapsed_days"
  | "scheduled_days"
  | "learning_steps"
  | "reps"
  | "lapses"
  | "state"
  | "lastReviewedAt"
> {
  const empty = createEmptyCard(new Date(now));
  return {
    due: empty.due.getTime(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    learning_steps: empty.learning_steps,
    reps: empty.reps,
    lapses: empty.lapses,
    state: fromStateEnum(empty.state),
    lastReviewedAt: empty.last_review ? empty.last_review.getTime() : null,
  };
}

function toFsrsCard(card: Card): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: toStateEnum(card.state),
    last_review: card.lastReviewedAt ? new Date(card.lastReviewedAt) : undefined,
  };
}

export type ReviewSnapshot = {
  rating: ReviewLog["rating"];
  state: FsrsState;
  due: number;
  review: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
};

export type ScheduledReview = {
  card: Card;
  log: ReviewSnapshot;
};

export function scheduleReview(card: Card, rating: Rating | Grade, reviewDate: number = Date.now()): ScheduledReview {
  const reviewAt = new Date(reviewDate);
  const grade = rating as Grade;
  const next = fsrs.next(toFsrsCard(card), reviewAt, grade);
  const updatedCard: Card = {
    ...card,
    due: next.card.due.getTime(),
    stability: next.card.stability,
    difficulty: next.card.difficulty,
    elapsed_days: next.card.elapsed_days,
    scheduled_days: next.card.scheduled_days,
    learning_steps: next.card.learning_steps,
    reps: next.card.reps,
    lapses: next.card.lapses,
    state: fromStateEnum(next.card.state),
    lastReviewedAt: reviewDate,
    updatedAt: reviewDate,
  };

  return {
    card: updatedCard,
    log: {
      rating: next.log.rating,
      state: fromStateEnum(next.log.state),
      review: next.log.review.getTime(),
      due: next.log.due.getTime(),
      stability: next.log.stability,
      difficulty: next.log.difficulty,
      elapsed_days: next.log.elapsed_days,
      scheduled_days: next.log.scheduled_days,
      learning_steps: next.log.learning_steps,
    },
  };
}

export function isDue(card: Card, now: number = Date.now()) {
  return card.due <= now;
}

export function setFsrsParameters(params: Partial<FSRSParameters>) {
  fsrs.parameters = { ...fsrs.parameters, ...params };
}

export function getFsrsParameters(): FSRSParameters {
  return fsrs.parameters;
}

export function getCardRetrievability(card: Card, now: number = Date.now()) {
  return fsrs.get_retrievability(
    {
      ...toFsrsCard(card),
    },
    new Date(now),
    false,
  );
}

export { Rating };
