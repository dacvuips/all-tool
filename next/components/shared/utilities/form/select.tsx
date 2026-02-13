import isEqual from "lodash/isEqual";
import { useEffect, useMemo, useRef, useState } from "react";

import { compressImage } from "../../../../lib/helpers/image";
import { useToast } from "../../../../lib/providers/toast-provider";
import { useDebounce } from "./../../../../lib/hooks/useDebounce";

const tailwindConfig = require("./../../../../tailwind.config");

const getTailwindColor = (color): { light: string; DEFAULT: string; dark: string } => {
  return tailwindConfig.theme.extend.colors[color];
};

// let createFilter: any;
// const ReactSelect = dynamic(() =>
//   import("react-select").then((mol) => {
//     createFilter = mol.createFilter;
//     return mol.default;
//   })
// );
// const CreatableSelect = dynamic(() => import("react-select/creatable").then((mol) => mol.default));

import { useTranslation } from "react-i18next";
import ReactSelect, { createFilter } from "react-select";
import CreatableSelect from "react-select/creatable";

export interface SelectProps extends FormControlProps {
  native?: boolean;
  options?: Option[];
  optionsPromise?: () => Promise<Option[]>;
  autocompletePromise?: ({
    id,
    search,
  }: {
    id?: string | string[];
    search?: string;
  }) => Promise<Option[]>;
  createablePromise?: (inputValue?: any) => Promise<Option | Option[]>;
  clearable?: boolean;
  searchable?: boolean;
  multi?: boolean;
  hasColor?: boolean;
  hasImage?: boolean;
  isAvatarImage?: boolean;
  dependency?: any;
  autosize?: boolean;
  menuIsOpen?: boolean;
  loading?: boolean;
  dropDownIcon?: JSX.Element;
  hasDropdownIndicator?: boolean;
  menuPosition?: "absolute" | "fixed";
  menuPlacement?:
    | "auto"
    | "top"
    | "bottom"
    | "top-start"
    | "top-end"
    | "bottom-start"
    | "bottom-end"
    | "right"
    | "left";
}
export function Select({
  controlClassName = "form-control",
  className = "",
  native = false,
  multi = false,
  searchable = true,
  clearable = false,
  hasColor = false,
  hasImage = false,
  isAvatarImage = false,
  hasDropdownIndicator = true,
  style = {},
  menuPosition = "absolute",
  menuPlacement,
  ...props
}: SelectProps) {
  const { t } = useTranslation();
  let [loading, setLoading] = useState(false);
  let [allOptions, setAllOptions] = useState<Option[]>([]);
  let [options, setOptions] = useState<Option[]>(props.options);
  let [value, setValue] = useState<any>();
  let [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);
  const hasValue = useMemo(() => value !== undefined, [value]);

  const toast = useToast();
  const selectRef = useRef();

  const [menuIsOpen, setMenuIsOpen] = useState<boolean>();
  const [menuWidth, setMenuWidth] = useState<number>();
  const [isPlaceholderLonger, setIsPlaceholderLonger] = useState(false);
  const [isCalculatingWidth, setIsCalculatingWidth] = useState(false);

  useEffect(() => {
    if (options) {
      if (props.value !== undefined) {
        if (native) {
          setValue(props.value || getDefaultValue({ multi, options }));
        } else {
          if (options?.length) {
            if (props.autocompletePromise) {
              let newAllOptions = allOptions.concat([
                ...options.filter((x) => !allOptions.find((y) => y.value == x.value)),
              ]);
              setAllOptions(newAllOptions);
              if (multi) {
                setValue(
                  newAllOptions.filter((x) => (props.value ? props.value.includes(x.value) : false))
                );
              } else {
                setValue(newAllOptions.find((x) => x.value == props.value) || null);
              }
            } else {
              if (multi) {
                setValue(
                  options.filter((x) => (props.value ? props.value.includes(x.value) : false))
                );
              } else {
                setValue(options.find((x) => x.value == props.value) || null);
              }
            }
          }
        }
      } else {
        setValue(getDefaultValue({ multi, options }));
      }
    }
  }, [props.value, options]);

  useEffect(() => {
    if (!isEqual(props.options, options)) {
      setOptions(props.options || []);
    }
  }, [props.options]);

  useEffect(() => {
    if (props.autosize && options?.length && !menuWidth && !isCalculatingWidth) {
      // console.log("selectRef", selectRef);
      setTimeout(() => {
        setIsCalculatingWidth(true);
        if (selectRef.current && (selectRef.current as any)?.select) {
          (selectRef.current as any)?.select.openMenu();
          setMenuIsOpen(true);
        }
      }, 100);
    }
  }, [props.autosize, options, menuWidth, isCalculatingWidth]);

  const onMenuOpen = () => {
    if (props.autosize && !menuWidth && isCalculatingWidth) {
      process.nextTick(() => {
        const select = (selectRef.current as any)?.select;
        const width =
          select && select.menuListRef ? select.menuListRef.getBoundingClientRect().width : 0;

        const selectControlRef = select?.controlRef;
        const selectPlaceHolder = selectControlRef
          ? selectControlRef.querySelector(".select__placeholder")
          : null;
        const placeholderWidth =
          props.placeholder && selectPlaceHolder
            ? selectPlaceHolder.getBoundingClientRect().width + 20
            : 0;
        setIsPlaceholderLonger(placeholderWidth > width);
        setMenuWidth(placeholderWidth > width ? placeholderWidth : width);
        setIsCalculatingWidth(false);

        if (select && select.onMenuClose) {
          (selectRef.current as any)?.select.onMenuClose();
        }

        setMenuIsOpen(undefined);
      });
      // setTimeout(() => {

      // }, 1);
    }
  };

  useEffect(() => {
    if (!options && props.optionsPromise) {
      setLoading(true);
      props.optionsPromise().then((res) => {
        setOptions(res);
        setLoading(false);
      });
    }
    if (props.autocompletePromise) {
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    if (props.value !== undefined && props.autocompletePromise) {
      setLoading(true);
      let id = props.value ?? "";
      if (typeof id !== "string" && typeof id !== "number") {
        id = id.map((x) => x.value);
      }
      let tasks = [];

      tasks.push(props.autocompletePromise({ search: "" }));
      if (typeof id == "string" ? id : id.length) {
        tasks.push(
          props.autocompletePromise({
            id,
          })
        );
      }

      Promise.all(tasks).then((res) => {
        let options = [...res[0]];
        if (res[1]?.length) {
          options = [...options, ...res[1].filter((x) => !options.find((y) => y.value == x.value))];
        }
        setOptions(options);
        setLoading(false);
      });
    }
  }, [props.value]);

  // get autocomplete from search
  useEffect(() => {
    if (options && props.autocompletePromise) {
      setLoading(true);
      props.autocompletePromise({ search: debouncedSearch }).then((res) => {
        setOptions(res);
        setLoading(false);
      });
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (props.autocompletePromise && allOptions && hasValue && value) {
      if (multi) {
        const valueStrings = value.map((x) => (typeof value == "string" ? x : x.value));
        const options = allOptions.filter((x) => valueStrings?.includes(x.value));
        setValue(options);
      } else {
        const option = allOptions.find(
          (x) => x.value == (typeof value == "string" ? value : value.value)
        );
        setValue(option);
      }
    }
  }, [allOptions, hasValue]);

  useEffect(() => {
    if (!options && props.createablePromise) {
      setLoading(true);
      props
        .createablePromise()
        .then((res) => {
          setOptions(res as Option[]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [props.createablePromise]);

  useEffect(() => {
    if (props.dependency) {
      fetchOptions();
    }
  }, [props.dependency]);

  const dot = (color: string = "gray") =>
    hasColor
      ? {
          alignItems: "center",
          display: "flex",
          ":before": {
            backgroundColor: getTailwindColor(color)?.DEFAULT || color,
            borderRadius: "50%",
            content: '" "',
            display: "block",
            marginRight: 8,
            height: 12,
            width: 12,
          },
        }
      : {};

  const image = (image: string = "") =>
    hasImage
      ? {
          alignItems: "center",
          display: "flex",
          ":before": {
            backgroundImage: image
              ? `url(${compressImage(image, 100)})`
              : isAvatarImage
              ? "url(/assets/default/avatar.png)"
              : "url(/assets/default/default.png)",
            backgroundRepeat: "no-repeat",
            backgroundColor: image !== null ? "#eee" : "transparent",
            backgroundPosition: "center center",
            backgroundSize: "cover",
            border: "0.5px solid #eee",
            borderRadius: isAvatarImage ? "50%" : "3px",
            content: '" "',
            display: "block",
            marginRight: "8px",
            transform: "translate(-2px) scale(1.6)",
            height: 20,
            width: 20,
            minWidth: 20,
          },
        }
      : {};

  const colourStyles = {
    menu: (css) => ({
      ...css,
      width: "auto",
      ...(props.autosize && isCalculatingWidth && { height: 0, visibility: "hidden" }),
    }),
    container: (css) => ({
      ...css,
      opacity: 1,
      transition: "all 0.1s ease-in-out",
      ...(props.autosize &&
        !menuWidth && {
          opacity: 0,
        }),
    }),
    valueContainer: (css) => ({
      ...css,
      ...(props.autosize &&
        menuWidth && {
          width: isPlaceholderLonger ? menuWidth : menuWidth,
        }),
    }),
    option: (styles, { data, isDisabled, isFocused, isSelected }) => {
      let optionStyles;
      if (hasColor) {
        const color = getTailwindColor(data.color) || data.color;
        optionStyles = {
          ...styles,
          backgroundColor: isDisabled
            ? null
            : isSelected
            ? color?.DEFAULT || data.color
            : isFocused
            ? color?.light
            : null,
          color: isDisabled ? "#ccc" : isSelected ? "white" : color?.DEFAULT || data.color,
          cursor: isDisabled ? "not-allowed" : "default",
          ":active": {
            ...styles[":active"],
            backgroundColor:
              !isDisabled && (isSelected ? color?.DEFAULT || data.color : color?.light),
          },
          ":hover": {
            backgroundColor: !isDisabled && !isSelected ? color?.light || "#fafafa" : null,
          },
        };
      } else if (hasImage) {
        optionStyles = { ...styles, ...image(data.image) };
      } else {
        optionStyles = { ...styles };
      }
      if (props.autosize) optionStyles.whiteSpace = "nowrap";
      if (props.autosize && menuWidth) {
        optionStyles = {
          ...optionStyles,
          // paddingRight: isPlaceholderLonger ? 0 : 36,
          width: isPlaceholderLonger ? menuWidth + 40 : menuWidth + 36,
        };
      }
      return optionStyles;
    },
    input: (styles) => (!multi ? { ...styles, ...dot(), ...image(null) } : { ...styles }),
    placeholder: (styles) => (!multi ? { ...styles, ...dot(), ...image(null) } : { ...styles }),
    singleValue: (styles, { data }) =>
      !multi ? { ...styles, ...dot(data.color), ...image(data.image) } : { ...styles },
    multiValue: (styles, { data }) =>
      hasColor && multi
        ? {
            ...styles,
            backgroundColor: getTailwindColor(data.color)?.DEFAULT || data.color,
          }
        : { ...styles },
    multiValueLabel: (styles, { data }) =>
      hasColor && multi
        ? {
            ...styles,
            color: getTailwindColor(data.color)?.DEFAULT || data.color,
          }
        : { ...styles },
    multiValueRemove: (styles, { data }) =>
      hasColor && multi
        ? {
            ...styles,
            color: getTailwindColor(data.color)?.DEFAULT || data.color,
            ":hover": {
              backgroundColor: getTailwindColor(data.color)?.DEFAULT || data.color,
              color: "white",
            },
          }
        : {
            ...styles,
            ":hover": {
              backgroundColor: getTailwindColor("danger").DEFAULT,
              color: "white",
            },
          },
  };

  const onChange = (option: any | Option | Option[]) => {
    if (props.onChange) {
      if (native) {
        props.onChange(
          option,
          options.find((x) => x.value == option)
        );
      } else {
        if (option) {
          if (Array.isArray(option)) {
            props.onChange(
              option.map((x) => x.value),
              option
            );
          } else {
            props.onChange(option.value, { ...option });
          }
        } else {
          if (multi) {
            props.onChange([], []);
          } else {
            props.onChange("", options.find((x) => !x.value) || null);
          }
        }
      }
    }
    setValue(option);
  };

  const createOption = async (inputValue: string) => {
    if (props.createablePromise) {
      try {
        setLoading(true);
        let res = (await props.createablePromise(inputValue.trim())) as Option;
        setOptions([...options, res]);
        onChange([...value, res]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const onInputChange = (term: string) => {
    if (props.autocompletePromise) {
      setSearch(term);
    }
  };

  const fetchOptions = () => {
    if (props.autocompletePromise) {
      setLoading(true);
      props.autocompletePromise({}).then((res) => {
        setOptions(res);
        setLoading(false);
      });
    }
    if (props.optionsPromise) {
      setLoading(true);
      props.optionsPromise().then((res) => {
        setOptions(res);
        setLoading(false);
      });
    }
  };

  const SelectComponent: any = props.createablePromise ? CreatableSelect : ReactSelect;

  return (
    <>
      {native ? (
        <select
          tabIndex={props.noFocus && -1}
          disabled={props.readOnly}
          className={`${controlClassName} ${props.error ? "error" : ""} ${className}`}
          value={value}
          id={props.id}
          name={props.name}
          style={{ ...style }}
          onChange={(e) => onChange(e.target.value)}
        >
          {props.options.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <SelectComponent
          tabIndex={props.noFocus && "-1"}
          ref={selectRef}
          onMenuOpen={onMenuOpen}
          menuIsOpen={menuIsOpen || props.menuIsOpen}
          id={props.id}
          name={props.name}
          options={options}
          value={value}
          onChange={onChange}
          onInputChange={onInputChange}
          className={`${controlClassName} ${multi ? "flex-1" : ""} px-0 ${
            props.error ? "error" : ""
          } ${className} ${props.autosize ? "react-select-autosize" : ""}`}
          style={{ ...style }}
          classNamePrefix="react-select"
          placeholder={
            props.placeholder ||
            (props.autocompletePromise ? t("Nhập để tìm kiếm") : t("Chưa chọn"))
          }
          menuPlacement={menuPlacement || "auto"}
          menuPosition={menuPosition || "absolute"}
          isLoading={loading || props.loading}
          isMulti={multi}
          isSearchable={searchable}
          isClearable={!props.readOnly && (clearable || !!props.autocompletePromise)}
          isDisabled={props.readOnly}
          instanceId={`${props.id || props.name}`}
          noOptionsMessage={() => t("Không có lựa chọn")}
          closeMenuOnSelect={!multi}
          closeMenuOnScroll={true}
          styles={colourStyles}
          filterOption={
            props.autocompletePromise
              ? (option: Option) => true
              : createFilter
              ? createFilter({
                  ignoreCase: true,
                  ignoreAccents: true,
                  trim: true,
                  matchFrom: "any",
                  stringify: (option: Option) => `${option.label} ${option.value}`,
                })
              : undefined
          }
          formatCreateLabel={(input) => `${t("Tạo mới")} "${input}"...`}
          onCreateOption={createOption}
          components={{ ...(hasDropdownIndicator ? {} : { DropdownIndicator: () => null }) }}
        />
      )}
    </>
  );
}

const getDefaultValue = (props: SelectProps) => {
  return props.multi
    ? []
    : props.options
    ? props.options?.find((x) => x.value === false)
      ? null
      : ""
    : "";
};

Select.getDefaultValue = getDefaultValue;
