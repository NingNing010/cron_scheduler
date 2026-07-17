import { IsDefined, IsString, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  name!: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  cronExpression!: string;
}
