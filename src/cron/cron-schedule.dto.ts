import { Transform } from 'class-transformer';
import { IsDefined, IsString, MinLength } from 'class-validator';
import { ValidateCronDto } from './validate-cron.dto';

export class CronScheduleDto extends ValidateCronDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsDefined()
  @IsString()
  @MinLength(1)
  jobName!: string;
}
