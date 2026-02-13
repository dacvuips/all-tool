import "reflect-metadata";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { plainToInstance } from "class-transformer";
import { validateSync, ValidationError } from "class-validator";
import _ from "lodash";
import { ForbiddenError } from "../errors";

export abstract class BaseCommand {
  static create<T extends BaseCommand>(this: new (...args: any[]) => T, data: T): T {
    const convertedObject = plainToInstance<T, any>(this, {
      ...data,
    });

    const errors = validateSync(convertedObject as unknown as object);
    if (errors?.length) {
      const mappedErrors = _.flatten(errors.map((error) => getValidationErrorConstraints(error)));
      throw new ForbiddenError(mappedErrors[0]);
    }

    return convertedObject;
  }
}

function getValidationErrorConstraints(error: ValidationError): string[] {
  if (error.constraints) {
    return Object.values(error.constraints);
  }
  if (error.children) {
    return _.flatten(error.children.map((item) => getValidationErrorConstraints(item)));
  }
  return [];
}
