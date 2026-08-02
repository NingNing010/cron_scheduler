import { Injectable } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

@ValidatorConstraint({ async: true })
@Injectable()
export class EmployeeCodeUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prismaService: PrismaService) {}

  async validate(code: string, _arguments: ValidationArguments): Promise<boolean> {
    if (!code) {
      return true;
    }

    const existing = await this.prismaService.employee.findFirst({
      where: { code, deletedAt: null },
      select: { id: true },
    });

    return !existing;
  }

  defaultMessage(): string {
    return 'Mã nhân viên đã tồn tại';
  }
}

export const IsEmployeeCodeUnique = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: EmployeeCodeUniqueConstraint,
    });
  };
};