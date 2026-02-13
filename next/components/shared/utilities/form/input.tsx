import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaRegEyeSlash } from "react-icons/fa";
import { RiExternalLinkLine, RiEyeLine } from "react-icons/ri";
import CreatableSelect from "react-select/creatable";
import MaskedInput from "react-text-mask";
import createNumberMask from "text-mask-addons/dist/createNumberMask";
import { useDebounce } from "./../../../../lib/hooks/useDebounce";
import { Button } from "./button";

export interface InputProps extends FormControlProps {
  type?: "text" | "tel" | "email" | "number" | "password" | "url" | "color";
  prefix?: JSX.Element | string;
  prefixClassName?: string;
  prefixInputFocus?: boolean;
  suffix?: JSX.Element | string;
  suffixClassName?: string;
  suffixInputFocus?: boolean;
  inputClassName?: string;
  clearable?: boolean;
  debounce?: number | boolean;
  number?: boolean;
  decimalSeparator?: "dot" | "comma";
  negative?: boolean;
  decimal?: boolean;
  currency?: boolean | string;
  autoFocus?: boolean;
  multi?: boolean;
  numberLength?: number;
  stringLength?: number;
  inputStyle?: any;
  showZeroDefaultValue?: boolean;
}
export function Input({
  type = "text",
  number = false,
  decimalSeparator = "dot",
  multi = false,
  controlClassName = "form-control",
  className = "",
  prefixClassName = "",
  suffixClassName = "",
  prefixInputFocus = true,
  suffixInputFocus = true,
  inputClassName = "",
  style = {},
  numberLength,
  stringLength,
  inputStyle = {},
  showZeroDefaultValue = true,
  ...props
}: InputProps) {
  const { t } = useTranslation();
  const [multiInputValue, setMultiInputValue] = useState("");
  const [multiValue, setMultiValue] = useState<Option[]>([]);
  const [value, setValue] = useState<string | string[]>(getDefaultValue(props));
  const [valueInited, setValueInited] = useState(false);
  const debouncedValue = useDebounce(
    value,
    props.debounce ? (typeof props.debounce == "boolean" ? 300 : props.debounce) : 0
  );
  const [showPassword, setShowPassword] = useState(false);
  const ref = useRef<HTMLInputElement>();
  const numLength = useMemo(() => numberLength || 10, [numberLength]);
  const strLength = useMemo(() => stringLength || 150, [stringLength]);
  const numberMask = useMemo(() => {
    return createNumberMask({
      prefix: "",
      suffix: props.currency ? (typeof props.currency == "boolean" ? "đ" : props.currency) : "",
      includeThousandsSeparator: true,
      thousandsSeparatorSymbol: decimalSeparator == "dot" ? "," : ".",
      allowDecimal: !!props.decimal,
      allowNegative: !!props.negative,
      decimalSymbol: decimalSeparator == "dot" ? "." : ",",
      decimalLimit: 2,
    });
  }, [props.currency, decimalSeparator, props.decimal, props.negative]);

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(
        (number && typeof props.value == "number"
          ? parseNumberToText(
              props.value,
              decimalSeparator,
              props.decimal,
              props.negative,
              props.currency ? (typeof props.currency == "boolean" ? "đ" : props.currency) : ""
            )
          : number
          ? props.value?.toString()
          : props.value || value) || getDefaultValue({ number, showZeroDefaultValue, multi })
      );
      if (multi) {
        setMultiValue(props.value?.map ? props.value.map((x) => ({ label: x, value: x })) : []);
      }
    } else {
      setValue(getDefaultValue({ number, showZeroDefaultValue, multi }));
      if (multi) {
        setMultiValue([]);
      }
    }
    setValueInited(true);
  }, [props.value]);

  useEffect(() => {
    if (valueInited && debouncedValue !== undefined && props.onChange) {
      props.onChange(
        debouncedValue,
        number || type == "number" ? parseTextToNumber(debouncedValue) : debouncedValue
      );
    }
  }, [debouncedValue]);

  // useEffect(() => {
  //   if (props.autoFocus && ref.current && (ref.current as any).inputElement) {
  //     (ref.current as any).inputElement?.focus();
  //     setTimeout(() => {
  //       (ref.current as any).inputElement?.select();
  //     });
  //   }
  // }, [ref]);

  const onMultiValueChange = (value: any, actionMeta: any) => {
    setValue(value.map((x) => x.value));
    setMultiValue(value);
  };

  const onKeyDown = async (event) => {
    if (!multiInputValue) return;
    switch (event.key) {
      case "Enter":
      case "Tab":
        event.preventDefault();
        setValue((value as string[]).concat(multiInputValue));
        setMultiValue(multiValue.concat({ label: multiInputValue, value: multiInputValue }));
        setMultiInputValue("");
    }
  };
  return !multi ? (
    <div
      className={`${controlClassName} px-0 relative flex items-center border-group group group-hover:border-primary focus-within:border-primary-dark ${
        props.readOnly ? "readOnly" : ""
      } ${props.error ? "error" : ""} ${className}`}
      style={{ ...style }}
    >
      {!!props.prefix && (
        <div
          className={`flex-shrink-0 flex justify-center items-center min-w-10 self-stretch text-gray-600 ${
            typeof props.prefix == "string" ? "px-2" : ""
          } ${prefixClassName}`}
          onClick={() => {
            prefixInputFocus ? ref.current?.focus() : false;
          }}
        >
          {props.prefix}
        </div>
      )}
      {type == "color" && (
        <div className={`w-10 h-full p-1 -mr-2 ${props.value === undefined ? "opacity-0" : ""}`}>
          <div className="w-full h-full overflow-hidden rounded">
            <input
              className="w-full h-full p-0 transform scale-150 bg-transparent"
              type="color"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
      )}
      {number ? (
        <MaskedInput
          tabIndex={props.noFocus && -1}
          mask={numberMask}
          className={`bg-transparent self-stretch flex-grow px-3 ${props.prefix ? "pl-1.5" : ""} ${
            props.suffix || props.clearable || type == "password" ? "pr-1.5" : ""
          } ${inputClassName || ""}`}
          id={props.id}
          name={props.name}
          value={value}
          type={showPassword ? "text" : type}
          readOnly={props.readOnly}
          placeholder={props.placeholder}
          onBlur={(e) => {
            setValue(e.target.value);
          }}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          maxLength={numLength}
        />
      ) : (
        <input
          autoComplete="on"
          tabIndex={props.noFocus && -1}
          ref={ref}
          className={`bg-transparent self-stretch flex-grow px-3 ${props.prefix ? "pl-1.5" : ""} ${
            props.suffix || props.clearable || type == "password" ? "pr-1.5" : ""
          } ${inputClassName || ""}`}
          id={props.id}
          name={props.name}
          value={value}
          type={showPassword || type == "color" ? "text" : type}
          readOnly={props.readOnly}
          placeholder={props.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => {
            setValue(e.target.value);
          }}
          autoFocus={props.autoFocus}
          maxLength={strLength}
          style={inputStyle}
          onKeyDown={onKeyDown}
        />
      )}
      {!props.readOnly && props.clearable && (
        <Button
          style={
            (value && !number) || (number && value != "0") ? {} : { opacity: 0, cursor: "text" }
          }
          className="h-auto self-stretch px-2.5 text-gray-500 hover:text-gray-600 ring-inset form-control__close-icon"
          hoverDarken
          unfocusable
          onClick={() => (value ? setValue("") : ref.current?.focus())}
        ></Button>
      )}
      {type == "password" && (
        <Button
          className="h-auto self-stretch px-2.5 text-gray-500 hover:text-gray-600 ring-inset"
          hoverDarken
          unfocusable
          onClick={() => {
            setShowPassword(!showPassword);
          }}
        >
          <i>{showPassword ? <FaRegEyeSlash /> : <RiEyeLine />}</i>
        </Button>
      )}
      {type == "url" && value && (
        <a
          className="btn-default hover-darken no-focus h-auto self-stretch px-2.5 text-gray-500 hover:text-gray-600 ring-inset"
          href={value as string}
          tabIndex={-1}
          target="_blank"
        >
          <i>
            <RiExternalLinkLine />
          </i>
        </a>
      )}
      {!!props.suffix && (
        <div
          className={`flex-shrink-0 flex justify-center items-center min-w-9 self-stretch text-gray-600 ${
            typeof props.suffix == "string" ? "px-2" : ""
          } ${suffixClassName}`}
          onClick={() => {
            suffixInputFocus ? ref.current?.focus() : false;
          }}
        >
          {props.suffix}
        </div>
      )}
    </div>
  ) : (
    <CreatableSelect
      tabIndex={props.noFocus && "-1"}
      id={props.id}
      name={props.name}
      className={`${controlClassName} px-0 ${props.error ? "error" : ""} ${className}`}
      style={{ ...style }}
      classNamePrefix="react-select"
      components={{
        DropdownIndicator: null,
      }}
      inputValue={multiInputValue}
      onInputChange={setMultiInputValue}
      isClearable={!props.readOnly && props.clearable}
      isDisabled={props.readOnly}
      instanceId={`${props.id || props.name}`}
      isMulti={multi}
      onChange={onMultiValueChange}
      onKeyDown={onKeyDown}
      placeholder={props.placeholder || t("Nhập nội dung và bấm Enter")}
      value={multiValue}
      menuIsOpen={false}
    />
  );
}

const numberWithCommasSeparator = (x: string) => {
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const numberWithDotsSeparator = (x: string) => {
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const parseNumberToText = (
  num: number | string,
  decimalSeparator: "dot" | "comma" = "dot",
  decimal: boolean = false,
  negative: boolean = true,
  currency: string = ""
) => {
  if (num !== undefined && num !== null) {
    if (typeof num == "number") {
      if (decimalSeparator == "dot") {
        let text: string;
        if (decimal) {
          text = num.toString();
        } else {
          text = Math.round(num).toString();
        }

        let negativeText = num < 0 ? "-" : "";
        let dotIndex = text.lastIndexOf(".");
        let integerText = text.slice(num < 0 ? 1 : 0, dotIndex == -1 ? undefined : dotIndex);
        let dotText = dotIndex == -1 ? "" : text.slice(dotIndex);
        return `${negative ? negativeText : ""}${numberWithCommasSeparator(
          integerText
        )}${dotText}${currency}`;
      } else {
        let text: string;
        if (decimal) {
          text = num.toString().replace(".", ",");
        } else {
          text = Math.round(num).toString();
        }

        let negativeText = num < 0 ? "-" : "";
        let commaIndex = text.lastIndexOf(",");
        let integerText = text.slice(num < 0 ? 1 : 0, commaIndex == -1 ? undefined : commaIndex);
        let commaText = commaIndex == -1 ? "" : text.slice(commaIndex);
        return `${negative ? negativeText : ""}${numberWithDotsSeparator(
          integerText
        )}${commaText}${currency}`;
      }
    } else {
      return num.toString();
    }
  }
  return 0;
};

export const parseTextToNumber = (text: string, decimalSeparator: "dot" | "comma" = "dot") => {
  if (text) {
    if (typeof text == "number") return text;

    if (decimalSeparator == "dot") {
      let num: string | number;
      num = text.replace(/[^0-9\-\.]/g, "").trim();
      if (num.endsWith(".")) num += "0";
      num = Number(num);
      return isNaN(num) ? 0 : num;
    } else {
      let num: string | number;
      num = text.replace(/[^0-9\-\,]/g, "").trim();
      num = num.replace(",", ".");
      if (num.endsWith(".")) num += "0";
      num = Number(num);
      return isNaN(num) ? 0 : num;
    }
  }
  return 0;
};

const getDefaultValue = (props: InputProps) => {
  return props.multi ? [] : props.number && props.showZeroDefaultValue ? "0" : "";
};

Input.getDefaultValue = getDefaultValue;
