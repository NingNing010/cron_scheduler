export type DynamicCronJobData = {
  jobType?: 'mail' | 'sync';
  taskId?: number;
  jobName: string;
  cronExpression: string;
  nextRun?: string;
  syncBatchSize?: number;
};
