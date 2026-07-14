import { ValidationOptions, registerDecorator, ValidationArguments } from 'class-validator';

const CRON_FIELD_PATTERN = /^[0-9A-Za-z*,/\-?#LW]+$/;

export function IsCronField(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsCronField',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && CRON_FIELD_PATTERN.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain a valid cron token set`;
        },
      },
    });
  };
}