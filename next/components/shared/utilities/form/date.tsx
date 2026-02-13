import endOfDay from "date-fns/endOfDay";
import endOfMonth from "date-fns/endOfMonth";
import isSameDay from "date-fns/isSameDay";
import startOfDay from "date-fns/startOfDay";
import startOfMonth from "date-fns/startOfMonth";
import { forwardRef, MutableRefObject, useEffect, useRef, useState } from "react";
import ReactDatePicker from "react-datepicker";
import { RiCalendar2Line } from "react-icons/ri";
import { Placement } from "tippy.js";

import { useTranslation } from "react-i18next";
import { formatDate } from "../../../../lib/helpers/parser";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// let isClosedRecently = false;
// function setIsClosedRecently(val) {
//   isClosedRecently = val;
// }
export interface DateProps extends FormControlProps {
  clearable?: boolean;
  dateFormat?: string;
  minDate?: Date;
  maxDate?: Date;
  includeDates?: Date[];
  excludeDates?: Date[];
  includeTimes?: Date[];
  excludeTimes?: Date[];
  filterDate?: (date) => boolean;
  filterTime?: (time) => boolean;
  monthsShown?: number;
  monthPicker?: boolean;
  yearPicker?: boolean;
  selectsRange?: boolean;
  fullHeader?: boolean;
  yearRange?: { start: number; end: number };
  time?: boolean;
  timeOnly?: boolean;
  timeIntervals?: number;
  startOfDay?: boolean;
  endOfDay?: boolean;
  placement?: Placement;
  inline?: boolean;
}
export function DatePicker({
  clearable = true,
  controlClassName = "form-control",
  className = "",
  minDate = null,
  maxDate = null,
  monthsShown = 1,
  timeIntervals = 30,
  style = {},
  ...props
}: DateProps) {
  let pickerFormat: string;
  if (props.monthPicker) pickerFormat = "MM/yyyy";
  else if (props.time) pickerFormat = "dd/MM/yyyy HH:mm";
  else if (props.timeOnly) pickerFormat = "HH:mm";
  else pickerFormat = props.yearPicker ? "yyyy" : "dd/MM/yyyy";
  if (props.dateFormat) pickerFormat = props.dateFormat;
  const { t } = useTranslation();
  const [value, setValue] = useState();
  const [range, setRange] = useState<DateRange>();
  const ref: MutableRefObject<any> = useRef();

  useEffect(() => {
    if (props.value && typeof props.value == "string") {
      props.value = new Date(props.value);
    }
    if (props.value !== undefined) {
      if (props.selectsRange) {
        setRange(
          props.value?.startDate && props.value?.endDate
            ? {
                startDate: new Date(props.value?.startDate),
                endDate: new Date(props.value?.endDate),
              }
            : getDefaultValue({})
        );
      } else {
        setValue(props.value);
      }
    } else {
      if (props.selectsRange) {
        setRange(getDefaultValue(props));
      } else {
        setValue(getDefaultValue(props));
      }
    }
  }, [props.value]);

  const onChange = (date) => {
    if (props.selectsRange) {
      const startDate = date[0]
        ? props.monthPicker
          ? startOfMonth(date[0])
          : startOfDay(date[0])
        : null;
      const endDate = date[1]
        ? props.monthPicker
          ? endOfMonth(new Date(date[1]))
          : endOfDay(new Date(date[1]))
        : null;

      setRange({
        startDate: startDate,
        endDate: endDate,
      });
      if (date[0] && date[1]) {
        ref.current.setOpen(false);
        if (props.onChange) {
          props.onChange({
            startDate: startDate,
            endDate: endDate,
          });
        }
      }
      if (!startDate && !endDate) {
        clearDate();
      }
    } else {
      setValue(date);
      if (props.onChange) {
        if (date && props.startOfDay) {
          props.onChange(startOfDay(date));
        } else if (date && props.endOfDay) {
          props.onChange(endOfDay(date));
        } else {
          props.onChange(date);
        }
      }
    }
  };

  const onClose = () => {
    if (props.selectsRange) {
      if (range && range.startDate && !range.endDate) {
        const newRange = {
          startDate: startOfDay(new Date(range.startDate)),
          endDate: endOfDay(new Date(range.startDate)),
        };
        setRange(newRange);
        if (props.onChange) {
          props.onChange(newRange);
        }
      }
    } else {
      // console.log(ref.current.input as HTMLInputElement);
      // setIsClosedRecently(true);
      // setTimeout(() => {
      //   ref.current.setFocus(true);
      //   // ref.current.input.focus();
      //   // console.log(ref.current);
      // });
      // setTimeout(() => {
      //   setIsClosedRecently(false);
      // }, 100);
    }
  };

  const clearDate = () => {
    if (props.selectsRange) {
      setRange(null);
      if (props.onChange) props.onChange(null);
    } else {
      setValue(null);
      if (props.onChange) props.onChange(null);
    }
  };

  const DateButton = () => (
    <button
      type="button"
      className="w-9 h-full flex justify-center items-center absolute top-0 right-0 pr-1.5 pointer-events-none text-gray-500 group-hover:text-gray-700 no-focus"
      tabIndex={-1}
    >
      <i className="text-xl">
        <RiCalendar2Line />
      </i>
    </button>
  );

  const ClearButton = () => (
    <button
      type="button"
      className="react-datepicker__close-icon"
      aria-label="Close"
      tabIndex={-1}
      onClick={clearDate}
    ></button>
  );
  const RangeInput = forwardRef(({ range, ...props }: any, rangeRef: any) => {
    return (
      <input
        {...props}
        value={
          range?.startDate
            ? `${t("Từ")} ${formatDate(range.startDate, "dd/MM/yyyy")}${
                range?.endDate && !isSameDay(range.startDate, range.endDate)
                  ? ` ${t("đến")} ${formatDate(range.endDate, "dd/MM/yyyy")}`
                  : ""
              }`
            : ""
        }
        ref={rangeRef}
        onChange={() => {}}
      />
    );
  });
  const DateInput = forwardRef((props: any, dateRef: any) => {
    return (
      <div className="relative group">
        <input
          {...props}
          ref={dateRef}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              ref.current.setOpen(false);
            }
          }}
        />
        {props.value && !props.readOnly && clearable ? <ClearButton /> : <DateButton />}
      </div>
    );
  });

  const years = props.fullHeader
    ? props.yearRange
      ? Array.from(
          { length: props.yearRange.end - props.yearRange.start },
          (v, i) => props.yearRange.start + i
        )
      : Array.from({ length: new Date().getFullYear() + 5 - 1990 }, (v, i) => 1990 + i)
    : [];
  const months = [
    t("Tháng 1"),
    t("Tháng 2"),
    t("Tháng 3"),
    t("Tháng 4"),
    t("Tháng 5"),
    t("Tháng 6"),
    t("Tháng 7"),
    t("Tháng 8"),
    t("Tháng 9"),
    t("Tháng 10"),
    t("Tháng 11"),
    t("Tháng 12"),
  ];

  const fullHeader = ({
    date,
    changeYear,
    changeMonth,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled,
  }) => (
    <div className="flex items-center justify-center">
      <button
        className="react-datepicker__navigation--previous"
        onClick={decreaseMonth}
        disabled={prevMonthButtonDisabled}
      />
      <div className="rounded border-group">
        <select
          className={`${controlClassName} w-20 pr-9`}
          value={date.getFullYear()}
          onChange={({ target: { value } }) => changeYear(value)}
        >
          {years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          className={`${controlClassName} w-28 pr-8`}
          value={months[date.getMonth()]}
          onChange={({ target: { value } }) => changeMonth(months.indexOf(value))}
        >
          {months.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <button
        className="react-datepicker__navigation--next"
        onClick={increaseMonth}
        disabled={nextMonthButtonDisabled}
      />
    </div>
  );

  const onKeyDown = (e) => {
    if (e.keyCode === 9 || e.which === 9) {
      ref.current.setOpen(false);
    }
  };

  return (
    <div className="relative">
      <ReactDatePicker
        tabIndex={props.noFocus && -1}
        ref={ref}
        className={`${controlClassName} ${props.error ? "error" : ""} pr-10 ${className}`}
        selected={props.selectsRange ? null : value}
        dateFormat={pickerFormat}
        isClearable={!props.readOnly && clearable}
        {...(minDate ? { minDate } : {})}
        {...(maxDate ? { maxDate } : {})}
        includeDates={props.includeDates}
        excludeDates={props.excludeDates}
        includeTimes={props.includeTimes}
        excludeTimes={props.excludeTimes}
        filterDate={props.filterDate}
        filterTime={props.filterTime}
        monthsShown={monthsShown}
        disabled={props.readOnly}
        placeholderText={props.placeholder}
        showMonthYearPicker={props.monthPicker}
        openToDate={props.selectsRange ? range?.startDate : value}
        startDate={range?.startDate || null}
        endDate={range?.endDate || null}
        selectsRange={props.selectsRange}
        shouldCloseOnSelect={props.selectsRange ? false : true}
        showTimeSelect={props.time || props.timeOnly}
        showTimeSelectOnly={props.timeOnly}
        timeIntervals={timeIntervals}
        onChange={onChange}
        onCalendarClose={onClose}
        timeCaption="Giờ"
        onKeyDown={onKeyDown}
        showYearPicker={props.yearPicker}
        popperPlacement={props.placement || "bottom-start"}
        inline={props.inline}
        customInput={
          props.selectsRange ? <RangeInput range={range} error={props.error} /> : undefined
        }
        {...(props.fullHeader ? { renderCustomHeader: fullHeader } : {})}
      />
      {((!props.selectsRange && value) || (props.selectsRange && range)) &&
      !props.readOnly &&
      clearable ? (
        <ClearButton />
      ) : (
        <DateButton />
      )}
    </div>
  );
}

const getDefaultValue = (props: DateProps): any => {
  return props?.selectsRange ? { startDate: null, endDate: null } : null;
};

DatePicker.getDefaultValue = getDefaultValue;
