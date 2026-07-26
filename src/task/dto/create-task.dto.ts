import { IsDefined, IsEmail, IsString, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  name!: string;

  // Thêm trường Email người nhận (kèm kiểm tra đúng định dạng email)
  @IsDefined()
  @IsEmail({}, { message: 'recipientEmail must be a valid email address' })
  recipientEmail!: string;

  // Thêm trường Tiêu đề email
  @IsDefined()
  @IsString()
  @MinLength(1)
  subject!: string;

  // Thêm trường Nội dung email
  @IsDefined()
  @IsString()
  @MinLength(1)
  content!: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  cronExpression!: string;
}
