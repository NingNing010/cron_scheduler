export type DynamicCronJobData = {
  jobName: string;
  cronExpression: string;
  nextRun?: string;
};
