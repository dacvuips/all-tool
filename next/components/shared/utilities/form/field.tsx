import { Children, cloneElement, MouseEventHandler, useEffect, useMemo, useState } from "react";
import { Controller, useFormContext, useFormState } from "react-hook-form";
import { Button, Label, Validation } from ".";
import { useMemoCompare } from "../../../../lib/hooks/useMemoCompare";
import { useUUID } from "../../../../lib/hooks/useUUID";
import { useFormPropsContext } from "./form";
import DOMPurify from "dompurify";

export interface FieldProps extends ReactProps {
  name?: string;
  namePrefix?: string;
  label?: string;
  labelClassName?: string;
  tooltip?: string;
  error?: string;
  description?: string;
  required?: boolean;
  noAsterisk?: boolean;
  readOnly?: boolean; // Không cho phép sửa nhưng giá trị không được gửi
  disabled?: boolean; // Không cho phép sửa nhưng giá trị vẫn được gửi
  noError?: boolean;
  noFocus?: boolean;
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  onClick?: MouseEventHandler<HTMLDivElement>;
  validation?: Partial<Validation>;
  locale?: string;
  multiLocales?: Option[];
  ingnoreUnregis?: boolean;
  dompurify?: boolean; // Cho phép sử dụng DOMPurify để lọc HTML
}
export function Field({
  namePrefix = "",
  onClick,
  validation = {},
  multiLocales,
  className = "",
  style = {},

  ...props
}: FieldProps) {
  const name = useMemo(
    () => `${namePrefix ? `${namePrefix}.` : ""}${props.name || ""}`,
    [props.name, namePrefix]
  );
  const { register, watch, control, setValue, getValues, clearErrors, unregister } =
    useFormContext() || {};
  const { readOnly } = useFormPropsContext();
  const { errors, isSubmitting } = useFormState() || { errors: {} };
  const [selectedLocale, setSelectedLocale] = useState<string>(
    multiLocales ? multiLocales[0].value : null
  );

  const id = useUUID();
  const child = Children.toArray(props.children)[0] as JSX.Element;
  const childProps = useMemoCompare(child.props);
  const error = useMemo(
    () => (errors && errors[name] ? errors[name].message : null) || props.error,
    [errors[name], props.error]
  );
  const isNumber = useMemo(() => {
    return childProps.number || childProps.type == "number";
  }, [childProps]);
  const isObjectId = useMemo(() => {
    return childProps.optionsPromise || childProps.autocompletePromise;
  }, [childProps]);
  const defaultValue = useMemo(() => {
    if (!name) return null;
    const defaultValue = childProps.defaultValue || child.type?.getDefaultValue(childProps);
    if (childProps.options?.length) {
      return childProps.clearable ? defaultValue : defaultValue || childProps.options[0].value;
    } else {
      return defaultValue;
    }
  }, [childProps]);
  const otherLocales = useMemo(
    () => (multiLocales?.length > 1 ? multiLocales.slice(1) : []),
    [multiLocales]
  );

  if (name) {
    const { email, phone, required, ...rest } = validation;
    const dataValue = getValues(name);
    register(name, {
      shouldUnregister: true,
      valueAsNumber: isNumber,
      value: dataValue !== undefined ? dataValue : defaultValue,
      ...{
        isObjectId,
        selectsRange: childProps.selectsRange,
        readOnly: props.readOnly || childProps.readOnly || readOnly,
        // disabled: props.disabled || childProps.disabled,
        validation: {
          required: props.required || childProps.required || required,
          email: childProps.type == "email" || email,
          phone: childProps.type == "tel" || phone,
          ...rest,
        },
      },
    });
    if (otherLocales?.length) {
      for (let i = 0; i < otherLocales?.length; i++) {
        register(`${namePrefix ? `${namePrefix}.` : ""}translation.${i}.locale`, {
          value: otherLocales[i].value,
        });
      }
      register(`${namePrefix ? `${namePrefix}.` : ""}locale`, {
        value: multiLocales[0].value,
      });
    }
  }

  const value = name ? watch(name) : undefined;
  const onChange = (val, extraVal) => {
    if (name) {
      if (typeof val == "string") {
        if (props.dompurify) {
          val = DOMPurify.sanitize(val);
        }
      }

      clearErrors(name);
      if (isNumber) {
        setValue(name, extraVal);
      } else {
        setValue(name, val);
      }
      if (childProps.onChange) childProps.onChange(val, extraVal);
    }
  };

  useEffect(() => {
    if (props.locale) {
      setSelectedLocale(props.locale);
    }
  }, [props.locale]);

  useEffect(() => {
    if (name) {
      if (value === undefined) {
        setValue(name, defaultValue);
      }
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (name && !props.ingnoreUnregis) {
        unregister(name);
        if (otherLocales?.length) {
          for (let i = 0; i < otherLocales?.length; i++) {
            unregister(`${namePrefix ? `${namePrefix}.` : ""}translation.${i}.locale`);
          }
          unregister(`${namePrefix ? `${namePrefix}.` : ""}locale`);
        }
      }
    };
  }, []);
  return (
    // <div
    //   className={`auto-rows-min animate-emerge flex flex-col ${
    //     props.cols ? "col-span-" + props.cols : "col-span-full"
    //   } ${className}`}
    //   style={{ ...style }}
    //   onClick={onClick}
    // >
    <div
      className={`auto-rows-min animate-emerge flex flex-col ${
        props.cols ? `col-span-${props.cols}` : "col-span-full"
      } ${className}`}
      style={{ ...style }}
      onClick={onClick}
    >
      {props.label && (
        <Label
          className={props.labelClassName}
          text={props.label}
          description={props.description}
          htmlFor={`${name}-${id}`}
          tooltip={props.tooltip}
          required={!props.noAsterisk && props.required}
          error={error}
        >
          {!!multiLocales?.length && !props.locale && (
            <div className="ml-auto rounded border-group">
              {multiLocales.map((locale) => (
                <Button
                  key={locale.value}
                  className="h-6 px-2 text-xs font-bold uppercase"
                  {...(locale.value == selectedLocale ? { primary: true } : { outline: true })}
                  text={locale.value}
                  tooltip={locale.label}
                  onClick={() => setSelectedLocale(locale.value)}
                />
              ))}
            </div>
          )}
        </Label>
      )}
      {name ? (
        <>
          <Controller
            name={name}
            control={control}
            render={() => (
              <>
                {cloneElement(child, {
                  ...childProps,
                  value,
                  onChange,
                  name,
                  id: `${name}-${id}`,
                  noFocus: props.noFocus,
                  readOnly:
                    props.readOnly ||
                    props.disabled ||
                    childProps.readOnly ||
                    readOnly ||
                    isSubmitting,
                  required: props.required || childProps.required,

                  error,
                  style:
                    !!otherLocales?.length && selectedLocale !== multiLocales[0].value
                      ? {
                          ...childProps.style,
                          display: "none",
                        }
                      : {
                          ...childProps.style,
                        },
                })}
              </>
            )}
          />
          {!!otherLocales?.length &&
            otherLocales.map((locale, index) => (
              <Field
                key={locale.value}
                className={className}
                name={`${namePrefix ? `${namePrefix}.` : ""}translation.${index}.${props.name}`}
                noError
                style={
                  selectedLocale !== locale.value
                    ? {
                        ...childProps.style,
                        display: "none",
                      }
                    : {
                        ...childProps.style,
                      }
                }
              >
                {props.children}
              </Field>
            ))}
        </>
      ) : (
        <>
          {cloneElement(
            child,
            child.type?.getDefaultValue
              ? {
                  value: childProps.value,
                  onChange: childProps.onChange,
                  noFocus: props.noFocus,
                  readOnly: props.readOnly || childProps.readOnly || readOnly || isSubmitting,
                  required: props.required || childProps.required,

                  error,
                }
              : null
          )}
        </>
      )}
      {!props.noError && (
        <div className="font-semibold text-sm pt-0.5 min-h-6 text-danger text-right pr-0.5">
          {error && <span className="form-error animate-emerge-up">{error}</span>}
        </div>
      )}
    </div>
  );
}
