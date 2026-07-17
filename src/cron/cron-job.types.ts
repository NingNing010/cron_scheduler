export type DynamicCronJobData = {
  taskId?: number;
  jobName: string;
  cronExpression: string;
  nextRun?: string;
};
