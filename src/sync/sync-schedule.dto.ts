import { Transform } from 'class-transformer';
import { IsDefined, IsString, MinLength } from 'class-validator';

const trimValue = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SyncScheduleDto {
  @Transform(trimValue)
  @IsDefined()
  @IsString()
  @MinLength(1)
  jobName!: string;

  @Transform(trimValue)
  @IsDefined()
  @IsString()
  @MinLength(1)
  cronExpression!: string;

  @Transform(({ value }) => Number(value))
  @IsDefined()
  batchSize!: number;
}