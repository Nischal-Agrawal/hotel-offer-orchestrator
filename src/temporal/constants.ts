export const TASK_QUEUE = 'hotel-orchestrator-queue';

export const WORKFLOW_ID_PREFIX = 'hotel-search';

export const ACTIVITY_TIMEOUTS = {
  startToCloseTimeout: '5s',
  retry: {
    initialInterval: '250ms',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '2s',
  },
} as const;
