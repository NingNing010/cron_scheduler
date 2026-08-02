import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class BulkGenerateEmployeeDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200000)
  count!: number;

  @Transform(({ value }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5000)
  batchSize?: number = 1000;
}