import get from "lodash/get";
import set from "lodash/set";
import { i18n } from "next-i18next";
import { Field, FieldValues, Resolver, ResolverOptions, ResolverResult } from "react-hook-form";
import { Locale } from "../../../../lib/repo/types";
export type ResolverFunction = (value: any, values: any) => string;
export type FormResolverFunction = (values: any) => string;
export type Validation = {
  required?: boolean;
  min?: number;
  max?: number;
  email?: boolean;
  phone?: boolean;
  code?: boolean;
  slug?: boolean;
  number?: boolean;
  countryCode?: Locale;
  [key: string]: ResolverFunction | boolean | number | string;
};

export const resolver: Resolver<FieldValues, object> = (
  values: any,
  context: any,
  options: ResolverOptions<FieldValues>
) => {
  const errors = {};
  const newValues = {};

  const checkField = (field: Field["_f"]) => {
    if (!field || (field as any).readOnly) return;
    const name = field.name;

    if (Array.isArray(field)) {
      field.forEach((item) => checkField(item));
      return;
    }

    // check for a name string property, if not then it would be a field that contains subfields
    if (!field.name || typeof field.name !== "string") {
      if (Object.keys(field)?.length) {
        for (const subFieldName of Object.keys(field)) {
          // if (field[subFieldName].validation) {
          checkField(field[subFieldName]);
          // }
        }
      }
      return;
    }

    let value = get(values, name);
    if (value instanceof Date) {
      value = (value as Date).toISOString();
    }
    if (field.valueAsNumber && typeof value !== "number") {
      value = Number(value);
    }
    const validations = ((field as any).validation as Validation) || {};
    if (field.required) validations["required"] = true;
    for (let key of Object.keys(validations)) {
      switch (key) {
        case "required": {
          if (!validations[key]) continue;
          if (value) {
            if (Array.isArray(value) && !value.length) {
              errors[name] = {
                message: i18n.t("Bắt buộc chọn"),
              };
            }
          } else {
            if (field.valueAsNumber) {
              errors[name] = {
                message: i18n.t("Bắt buộc khác 0"),
              };
            } else {
              errors[name] = {
                message: i18n.t("Bắt buộc"),
              };
            }
          }
          break;
        }
        case "min": {
          const min: number = validations[key];
          if (min === null || min === undefined || isNaN(min)) continue;

          if (typeof value == "string" && value?.length < min) {
            errors[name] = {
              message: `${i18n.t("Ít nhất")} ${min} ${i18n.t("ký tự")}`,
            };
          } else if (field.valueAsNumber && value < min) {
            errors[name] = {
              message: `${i18n.t("Lớn hơn hoặc bằng")} ${min}`,
            };
          } else if (Array.isArray(value) && value?.length < min) {
            errors[name] = {
              message: `${i18n.t("Chọn ít nhất")} ${min}`,
            };
          }
          break;
        }
        case "max": {
          const max: number = validations[key];
          if (max === null || max === undefined || isNaN(max)) continue;

          if (typeof value == "string" && value?.length > max) {
            errors[name] = {
              message: `${i18n.t("Tối đa")} ${max} ${i18n.t("ký tự")}`,
            };
          } else if (field.valueAsNumber && value > max) {
            errors[name] = {
              message: `${i18n.t("Nhỏ hơn hoặc bằng")} ${max}`,
            };
          } else if (Array.isArray(value) && value?.length > max) {
            errors[name] = {
              message: `${i18n.t("Chọn tối đa")} ${max}`,
            };
          }
          break;
        }
        case "email": {
          if (!validations[key] || !value) continue;
          const regex =
            /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
          if (!regex.test(String(value).toLowerCase())) {
            errors[name] = {
              message: i18n.t("Sai định dạng email"),
            };
          }
          break;
        }
        case "phone": {
          if (!validations[key] || !value) continue;
          const regexs = {
            vi: /^((\+84|0|84)[3|5|7|8|9])+([0-9]{8})$/,
            en: /^\+1\d{10}$|^1\d{10}$|^\d{10}$/,
            ja: /^(?:\+81|81)\d{1,4}\d{1,4}\d{4}$/,
            ko: /^(\+82|82)(10|1[1-9])(\d{7,8})$/,
          };

          const regex = regexs[validations.countryCode || "vi"];

          if (!regex.test(String(value).toLowerCase())) {
            errors[name] = {
              message: i18n.t("Sai định dạng số điện thoại"),
            };
          }
          break;
        }
        case "code":
        case "slug": {
          if (!validations[key] || !value) continue;
          const regex = /^([a-zA-Z0-9])(?:[-_a-zA-Z0-9])*$/;
          if (!regex.test(String(value).toLowerCase())) {
            errors[name] = {
              message: i18n.t("Chỉ gồm ký tự, số, gạch nối và gạch dưới"),
            };
          }
          break;
        }
        case "number": {
          if (!validations[key] || !value) continue;
          const regex = /^\d+$/;
          if (!regex.test(String(value))) {
            errors[name] = {
              message: i18n.t("Chỉ được nhập số"),
            };
          }
          break;
        }
        default: {
          if (!validations[key] || typeof validations[key] !== "function") {
            continue; // Skip if no validation or it's not a function
          }
          const resolver = validations[key] as ResolverFunction;
          const error = resolver(value, values);

          if (error) {
            errors[name] = {
              message: error,
            };
          }
        }
      }
      if (errors[name]) break;
    }

    if (!errors[name]) {
      if ((field as any).isObjectId && !value) {
        set(newValues, name, null);
      } else {
        set(newValues, name, value);
      }
    }
  };

  for (let name of Object.keys(options.fields)) {
    const field = options.fields[name];
    checkField(field);
  }

  if (Object.keys(errors).length) {
    console.log("form errors", errors, newValues);
  }
  const result: ResolverResult<FieldValues> = {
    values: Object.keys(errors).length ? {} : newValues,
    errors,
  };

  return result;
};
