import { describe, expect, it } from 'vitest';

import {
  generationSessionReducer,
  initialGenerationSessionState,
  isAnyTaskRunning,
} from './generation-session-reducer';

describe('generation-session-reducer', () => {
  it('starts a new session with reset tasks and unchecked preserve option', () => {
    const next = generationSessionReducer(initialGenerationSessionState, {
      type: 'SESSION_STARTED',
      runId: 5,
    });

    expect(next.runId).toBe(5);
    expect(next.tasks.flashcards.phase).toBe('idle');
    expect(next.tasks.audio.phase).toBe('idle');
    expect(next.tasks.images.phase).toBe('idle');
    expect(next.preserveGeneratedOnInterrupt).toBe(false);
    expect(next.interruptRequested).toBe(false);
  });

  it('tracks task progress and completion', () => {
    const started = generationSessionReducer(initialGenerationSessionState, {
      type: 'TASK_STARTED',
      task: 'flashcards',
    });
    const progressed = generationSessionReducer(started, {
      type: 'TASK_PROGRESS',
      task: 'flashcards',
      completed: 30,
      total: 60,
    });
    const completed = generationSessionReducer(progressed, {
      type: 'TASK_COMPLETED',
      task: 'flashcards',
    });

    expect(started.tasks.flashcards.phase).toBe('running');
    expect(progressed.tasks.flashcards.progressPercent).toBe(50);
    expect(completed.tasks.flashcards.phase).toBe('completed');
    expect(completed.tasks.flashcards.progressPercent).toBe(100);
  });

  it('opens and closes interrupt confirmation', () => {
    const opened = generationSessionReducer(initialGenerationSessionState, {
      type: 'INTERRUPT_CONFIRM_OPENED',
    });
    const closed = generationSessionReducer(opened, {
      type: 'INTERRUPT_CONFIRM_CLOSED',
    });

    expect(opened.isInterruptConfirmOpen).toBe(true);
    expect(closed.isInterruptConfirmOpen).toBe(false);
  });

  it('marks interrupt requested on confirm', () => {
    const next = generationSessionReducer(initialGenerationSessionState, {
      type: 'INTERRUPT_CONFIRMED',
    });

    expect(next.interruptRequested).toBe(true);
    expect(next.isInterruptConfirmOpen).toBe(false);
  });

  it('resets session state while preserving run id', () => {
    const started = generationSessionReducer(initialGenerationSessionState, {
      type: 'SESSION_STARTED',
      runId: 2,
    });
    const withTask = generationSessionReducer(started, {
      type: 'TASK_STARTED',
      task: 'audio',
    });
    const reset = generationSessionReducer(withTask, {
      type: 'SESSION_RESET',
    });

    expect(reset.runId).toBe(2);
    expect(reset.tasks.audio.phase).toBe('idle');
    expect(reset.interruptRequested).toBe(false);
    expect(reset.preserveGeneratedOnInterrupt).toBe(false);
  });

  it('reports running tasks correctly', () => {
    expect(isAnyTaskRunning(initialGenerationSessionState)).toBe(false);

    const running = generationSessionReducer(initialGenerationSessionState, {
      type: 'TASK_STARTED',
      task: 'images',
    });
    expect(isAnyTaskRunning(running)).toBe(true);

    const cancelled = generationSessionReducer(running, {
      type: 'TASK_CANCELLED',
      task: 'images',
    });
    expect(isAnyTaskRunning(cancelled)).toBe(false);
  });
});
