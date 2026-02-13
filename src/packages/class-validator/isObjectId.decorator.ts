import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";
import { ObjectId } from "bson";

export function IsObjectId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "IsObjectId",
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return ObjectId.isValid(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid objectId`;
        },
      },
    });
  };
}

export function IsArrayObjectId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "IsArrayObjectId",
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!Array.isArray(value)) {
            return false;
          }
          return value.every((item) => ObjectId.isValid(item));
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be array of objectId`;
        },
      },
    });
  };
}
