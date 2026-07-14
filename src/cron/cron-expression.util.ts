import { ValidateCronDto } from './validate-cron.dto';

export function buildCronExpression(dto: ValidateCronDto): string {
  return `${dto.minute} ${dto.hour} ${dto.day} ${dto.month} ${dto.weekday}`;
}
