import { Injectable } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { buildCronExpression } from './cron-expression.util';
import { ValidateCronDto } from './validate-cron.dto';

export type ValidateCronSuccessResponse = {
  valid: true;
  cronExpression: string;
  nextRun: Date;
};

export type ValidateCronErrorResponse = {
  valid: false;
  cronExpression: string;
  code: 'INVALID_CRON';
  message: string;
};

export type ValidateCronResponse =
  | ValidateCronSuccessResponse
  | ValidateCronErrorResponse;

@Injectable()
export class CronValidationService {
  validate(dto: ValidateCronDto): ValidateCronResponse {
    const cronExpression = buildCronExpression(dto);

    try {
      const interval = CronExpressionParser.parse(cronExpression);

      return {
        valid: true,
        cronExpression,
        nextRun: interval.next().toDate(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid cron expression';

      return {
        valid: false,
        cronExpression,
        code: 'INVALID_CRON',
        message,
      };
    }
  }
}
