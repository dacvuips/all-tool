import Ajv from "ajv";
import AjvError from "ajv-errors";
import { JSONSchema7 } from "json-schema";
import { BaseError } from "../libs/core";

export interface IValidateSchema extends JSONSchema7 {
  errorMessage?: object | string;
}

/**
 * Kiểm tra dữ liệu JSON, không trả về lỗi.
 * @param data
 * @param schema
 */
export function validateSchema(data: any, schema: JSONSchema7) {
  const ajv = new Ajv({ allErrors: true, jsonPointers: true });
  AjvError(ajv);
  const test = ajv.compile(schema);
  const isValid = test(data);
  return {
    isValid,
    result: test,
  };
}

export function validateJSON(data: any, schema: IValidateSchema) {
  const { isValid, result } = validateSchema(data, schema);
  if (isValid) {
    return true;
  } else {
    let message = result.errors.map((err) => err.message).toString();
    throw new BaseError("data-invalid-error", message, 400);
  }
}

export function validatePassword(password: string) {
  validateJSON(password, {
    type: "string",
    minLength: 6,
    errorMessage: "mật khẩu phải có ít nhất 6 ký tự",
  });
}

export function validateEmail(email: string) {
  validateJSON(email, {
    type: "string",
    format: "email",
    errorMessage: "email không đúng định dạng",
  });
}
