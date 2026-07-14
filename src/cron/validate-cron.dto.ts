import { Transform } from 'class-transformer';
import { IsDefined, IsString, MinLength } from 'class-validator';
import { IsCronField } from './cron-field.validator';

const trimStringIfPresent = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class ValidateCronDto {
  @Transform(trimStringIfPresent)
  @IsDefined()
  @IsString()
  @MinLength(1)
  @IsCronField({ message: 'minute has invalid cron syntax' })
  minute!: string;

  @Transform(trimStringIfPresent)
  @IsDefined()
  @IsString()
  @MinLength(1)
  @IsCronField({ message: 'hour has invalid cron syntax' })
  hour!: string;

  @Transform(trimStringIfPresent)
  @IsDefined()
  @IsString()
  @MinLength(1)
  @IsCronField({ message: 'day has invalid cron syntax' })
  day!: string;

  @Transform(trimStringIfPresent)
  @IsDefined()
  @IsString()
  @MinLength(1)
  @IsCronField({ message: 'month has invalid cron syntax' })
  month!: string;

  @Transform(trimStringIfPresent)
  @IsDefined()
  @IsString()
  @MinLength(1)
  @IsCronField({ message: 'weekday has invalid cron syntax' })
  weekday!: string;
}
