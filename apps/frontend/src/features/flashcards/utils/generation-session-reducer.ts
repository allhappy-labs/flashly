export type GenerationTaskId = 'flashcards' | 'audio' | 'images';

export type GenerationTaskPhase = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export type GenerationTaskState = Readonly<{
  phase: GenerationTaskPhase;
  progressCompleted: number;
  progressTotal: number;
  progressPercent: number;
  error: string | null;
}>;

export type GenerationSessionState = Readonly<{
  runId: number;
  tasks: Readonly<Record<GenerationTaskId, GenerationTaskState>>;
  isInterruptConfirmOpen: boolean;
  preserveGeneratedOnInterrupt: boolean;
  interruptRequested: boolean;
}>;

export type GenerationSessionAction =
  | { type: 'SESSION_STARTED'; runId: number }
  | { type: 'SESSION_RESET' }
  | { type: 'TASK_STARTED'; task: GenerationTaskId }
  | { type: 'TASK_PROGRESS'; task: GenerationTaskId; completed: number; total: number }
  | { type: 'TASK_COMPLETED'; task: GenerationTaskId }
  | { type: 'TASK_FAILED'; task: GenerationTaskId; error?: string }
  | { type: 'TASK_CANCELLED'; task: GenerationTaskId }
  | { type: 'INTERRUPT_CONFIRM_OPENED' }
  | { type: 'INTERRUPT_CONFIRM_CLOSED' }
  | { type: 'INTERRUPT_PRESERVE_TOGGLED'; value: boolean }
  | { type: 'INTERRUPT_CONFIRMED' };

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function createTaskState(): GenerationTaskState {
  return {
    phase: 'idle',
    progressCompleted: 0,
    progressTotal: 0,
    progressPercent: 0,
    error: null,
  };
}

function createTasks(): Record<GenerationTaskId, GenerationTaskState> {
  return {
    flashcards: createTaskState(),
    audio: createTaskState(),
    images: createTaskState(),
  };
}

export const initialGenerationSessionState: GenerationSessionState = {
  runId: 0,
  tasks: createTasks(),
  isInterruptConfirmOpen: false,
  preserveGeneratedOnInterrupt: false,
  interruptRequested: false,
};

function updateTask(
  state: GenerationSessionState,
  task: GenerationTaskId,
  update: (current: GenerationTaskState) => GenerationTaskState,
): GenerationSessionState {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [task]: update(state.tasks[task]),
    },
  };
}

export function isAnyTaskRunning(state: GenerationSessionState): boolean {
  return state.tasks.flashcards.phase === 'running'
    || state.tasks.audio.phase === 'running'
    || state.tasks.images.phase === 'running';
}

export function generationSessionReducer(
  state: GenerationSessionState,
  action: GenerationSessionAction,
): GenerationSessionState {
  switch (action.type) {
    case 'SESSION_STARTED':
      return {
        runId: action.runId,
        tasks: createTasks(),
        isInterruptConfirmOpen: false,
        preserveGeneratedOnInterrupt: false,
        interruptRequested: false,
      };
    case 'SESSION_RESET':
      return {
        ...state,
        tasks: createTasks(),
        isInterruptConfirmOpen: false,
        preserveGeneratedOnInterrupt: false,
        interruptRequested: false,
      };
    case 'TASK_STARTED':
      return updateTask(state, action.task, () => ({
        phase: 'running',
        progressCompleted: 0,
        progressTotal: 0,
        progressPercent: 0,
        error: null,
      }));
    case 'TASK_PROGRESS':
      return updateTask(state, action.task, (current) => {
        const safeCompleted = Math.max(0, action.completed);
        const safeTotal = Math.max(0, action.total);
        const progressPercent = safeTotal > 0
          ? clampPercent((safeCompleted / safeTotal) * 100)
          : current.progressPercent;
        return {
          ...current,
          phase: 'running',
          progressCompleted: safeCompleted,
          progressTotal: safeTotal,
          progressPercent,
        };
      });
    case 'TASK_COMPLETED':
      return updateTask(state, action.task, (current) => ({
        ...current,
        phase: 'completed',
        progressPercent: current.progressTotal > 0 ? 100 : current.progressPercent,
        error: null,
      }));
    case 'TASK_FAILED':
      return updateTask(state, action.task, (current) => ({
        ...current,
        phase: 'failed',
        error: action.error ?? current.error,
      }));
    case 'TASK_CANCELLED':
      return updateTask(state, action.task, (current) => ({
        ...current,
        phase: 'cancelled',
      }));
    case 'INTERRUPT_CONFIRM_OPENED':
      return {
        ...state,
        isInterruptConfirmOpen: true,
      };
    case 'INTERRUPT_CONFIRM_CLOSED':
      return {
        ...state,
        isInterruptConfirmOpen: false,
      };
    case 'INTERRUPT_PRESERVE_TOGGLED':
      return {
        ...state,
        preserveGeneratedOnInterrupt: action.value,
      };
    case 'INTERRUPT_CONFIRMED':
      return {
        ...state,
        interruptRequested: true,
        isInterruptConfirmOpen: false,
      };
    default:
      return state;
  }
}
