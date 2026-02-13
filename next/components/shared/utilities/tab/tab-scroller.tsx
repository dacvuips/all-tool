import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useDevice } from "../../../../lib/hooks/useDevice";
import { Button } from "../form";

interface Props extends ReactProps {
  options: Option[];
  tabClassName?: string;
  activeTabClassName?: string;
  dividerClassName?: string;
  value: any;
  onChange: (val) => any;
}
export function TabScroller({
  options,
  className = "",
  tabClassName = "",
  activeTabClassName = "",
  dividerClassName = "",
  ...props
}: Props) {
  const ref = useRef<HTMLDivElement>();
  const [isOverflow, setIsOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkOverflow = () => {
    setTimeout(() => {
      if (ref.current && ref.current.scrollWidth > ref.current.offsetWidth) {
        setIsOverflow(true);
      } else {
        setIsOverflow(false);
      }

      if (ref.current && ref.current.scrollLeft > 0) {
        setCanScrollLeft(true);
      } else {
        setCanScrollLeft(false);
      }

      if (
        ref.current &&
        ref.current.scrollWidth - (ref.current.scrollLeft + ref.current.offsetWidth)
      ) {
        setCanScrollRight(true);
      } else {
        setCanScrollRight(false);
      }
    }, 300);
  };

  const [value, setValue] = useState();

  useEffect(() => {
    setValue(props.value);
  }, [props.value]);

  useEffect(() => {
    let el = document.getElementById(`tab-scroller-${value}`);
    if (el) {
      ref.current.scrollTo({
        behavior: "smooth",
        left: el.offsetLeft - el.offsetWidth / 2,
      });
    }
    checkOverflow();
  }, [value]);

  const { isDesktop } = useDevice();

  return (
    <div ref={ref} className={`relative flex overflow-x-auto no-scrollbar ${className}`}>
      {isOverflow && isDesktop && (
        <Button
          className="sticky left-0 z-10 px-2 bg-white border-r border-gray-100 rounded-sm"
          icon={<FaChevronLeft />}
          disabled={!canScrollLeft}
          onClick={() => {
            ref.current.scrollTo({
              left: ref.current.scrollLeft - ref.current.scrollWidth / 4,
              behavior: "smooth",
            });
            checkOverflow();
          }}
        />
      )}
      {options.map((option, index) => (
        <div
          id={`tab-scroller-${option.value}`}
          key={option.value}
          className={`relative ${tabClassName} ${value == option.value ? activeTabClassName : ""}`}
          onClick={() => {
            setValue(option.value);
            props.onChange(option.value);
          }}
        >
          {option.label}
          {dividerClassName && index !== options.length - 1 && (
            <div className={dividerClassName}></div>
          )}
        </div>
      ))}
      {isOverflow && isDesktop && (
        <Button
          className="sticky right-0 z-10 px-2 bg-white border-r border-gray-100 rounded-sm"
          icon={<FaChevronRight />}
          disabled={!canScrollRight}
          onClick={() => {
            ref.current.scrollTo({
              left: ref.current.scrollLeft + ref.current.scrollWidth / 4,
              behavior: "smooth",
            });
            checkOverflow();
          }}
        />
      )}
    </div>
  );
}
