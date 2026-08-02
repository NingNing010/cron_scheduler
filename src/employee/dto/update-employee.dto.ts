import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const trimValue = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateEmployeeDto {
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @Length(3, 32)
  code?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(trimValue)
  @IsOptional()
  @Matches(/^[0-9+\-()\s]{8,20}$/i, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @Transform(trimValue)
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}