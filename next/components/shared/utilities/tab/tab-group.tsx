import { Children, CSSProperties, Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";
import { useUUID } from "../../../../lib/hooks/useUUID";
import { Button } from "../form";

interface PropsType extends ReactProps {
  index?: number;
  flex?: boolean;
  name?: string;
  hasArrow?: boolean;
  hasArrowClassName?: string;
  tabClassName?: string;
  activeClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
  hasInkBar?: boolean;
  inkbarClassName?: string;
  onChange?: (index: number) => any;
  count?: number;
}
export function TabGroup({
  index,
  flex = true,
  hasArrow = false,
  hasInkBar = true,
  name = "",
  bodyStyle = {},
  tabClassName = "",
  titleClassName = "text-base font-semibold whitespace-nowrap",
  subtitleClassName = "text-sm font-normal",
  inkbarClassName = "absolute bottom-0 h-1 transition-all duration-300 ease-in-out origin-center bg-primary",
  activeClassName = "",
  bodyClassName = "",
  hasArrowClassName = "",
  className = "",
  count = null,
  ...props
}: PropsType) {
  const id = useUUID();
  const inkbarRef = useRef<HTMLDivElement>();
  const tabRef = useRef<HTMLDivElement>();
  const [tabs, setTabs] = useState<
    { label: string; subtitle?: string; count?: number; child: JSX.Element }[]
  >([]);
  const isControlled = index !== undefined;
  const [selectedIndex, setSelectedIndex] = useState(index ?? 0);
  /** Optimistic index while controlled parent is catching up after click */
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const activeIndex = isControlled
    ? pendingIndex !== null
      ? pendingIndex
      : index!
    : selectedIndex;

  useEffect(() => {
    const tabs = [];
    Children.forEach(props.children, (child) => {
      if (child?.type === Fragment) {
        Children.forEach(child.props.children, (child) => {
          if (child?.type?.displayName === "Tab") {
            tabs.push({ ...child.props, child, index: tabs.length });
          }
        });
      } else if (child?.type?.displayName === "Tab") {
        tabs.push({ ...child.props, child, index: tabs.length });
      }
    });
    setTabs(tabs);
  }, [props.children]);

  useEffect(() => {
    if (activeIndex !== undefined && inkbarRef.current && tabs[activeIndex]) {
      if (name && !isControlled) {
        sessionStorage.setItem("tab-group-" + name, activeIndex.toString());
      }
      const el = document.getElementById(id + "-" + activeIndex);
      if (el) {
        inkbarRef.current.style.width = el.offsetWidth - 16 + "px";
        inkbarRef.current.style.left = el.offsetLeft + 8 + "px";
      }
    }
  }, [inkbarRef.current, tabs, activeIndex]);

  useEffect(() => {
    if (index !== undefined) {
      setSelectedIndex(index);
      setPendingIndex(null);
    } else {
      const stored = name ? sessionStorage.getItem("tab-group-" + name) : null;
      setSelectedIndex(Number(stored || 0));
    }
  }, [index]);

  useEffect(() => {
    if (activeIndex >= 0) {
      const el = document.getElementById(`${id}-${activeIndex}`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      checkArrow();
    }
  }, [activeIndex]);

  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkArrow = () => {
    if (hasArrow) {
      setTimeout(() => {
        setShowLeft(tabRef.current?.scrollLeft > 32);
        setShowRight(
          tabRef.current?.scrollWidth - (tabRef.current?.scrollLeft + tabRef.current?.offsetWidth) >
            32
        );
      }, 300);
    }
  };

  return (
    <>
      {!!tabs.length && (
        <>
          <div className="relative w-full overflow-hidden bg-white border-b border-gray-200">
            <Button
              icon={<RiArrowLeftSLine />}
              iconClassName="text-2xl"
              style={{
                boxShadow: "4px 0 8px -1px rgba(0, 0, 0, 0.1), 2px 0 6px -1px rgba(0, 0, 0, 0.06)",
                opacity: showLeft ? 1 : 0,
              }}
              className={`absolute left-0 z-10 h-full px-0 transition-opacity bg-white border-r border-gray-100 rounded-none shadow-xl w-7 ${hasArrowClassName}`}
              onClick={() => {
                tabRef.current.scrollTo({
                  left: tabRef.current.scrollLeft - tabRef.current.scrollWidth / 4,
                  behavior: "smooth",
                });
                checkArrow();
              }}
            />
            <Button
              icon={<RiArrowRightSLine />}
              iconClassName="text-2xl"
              style={{
                boxShadow:
                  "-4px 0 8px -1px rgba(0, 0, 0, 0.1), -2px 0 6px -1px rgba(0, 0, 0, 0.06)",
                opacity: showRight ? 1 : 0,
              }}
              className={`absolute right-0 z-10 h-full px-0 bg-white border-l border-gray-100 rounded-none shadow-xl w-7 ${hasArrowClassName}`}
              onClick={() => {
                tabRef.current.scrollTo({
                  left: tabRef.current.scrollLeft + tabRef.current.scrollWidth / 4,
                  behavior: "smooth",
                });
                checkArrow();
              }}
            />
            <div
              id={id}
              ref={tabRef}
              className={`text-center relative flex items-center overflow-x-auto no-scrollbar ${
                hasArrow ? "px-4" : ""
              } ${className}`}
            >
              {tabs.map((tab, index) => (
                <a
                  key={index}
                  id={id + "-" + index}
                  className={`cursor-pointer relative flex flex-col items-center ${
                    activeIndex == index
                      ? `text-gray-800 ${activeClassName}`
                      : "text-gray-600 hover:text-gray-800"
                  } ${flex ? "flex-1" : ""} ${tabClassName}`}
                  onClick={() => {
                    if (isControlled) {
                      setPendingIndex(index);
                    } else {
                      setSelectedIndex(index);
                    }
                    if (props.onChange) props.onChange(index);
                  }}
                >
                  {tab.count && tab.count != 0 ? (
                    <div className="absolute top-1 right-1 w-4 p-0.5 leading-none text-white bg-red-500 border rounded-full text-10">
                      {tab.count}
                    </div>
                  ) : (
                    ""
                  )}
                  <div className={titleClassName}>{tab.label}</div>
                  <div className={subtitleClassName}>{tab.subtitle}</div>
                </a>
              ))}
              {hasInkBar && <div className={`${inkbarClassName}`} ref={inkbarRef}></div>}
            </div>
          </div>
          <div className={`${bodyClassName}`} style={bodyStyle}>
            {tabs[activeIndex]?.child}
          </div>
        </>
      )}
    </>
  );
}

interface TabPropsType extends ReactProps {
  label: ReactNode | string;
  subtitle?: string;
  count?: string;
}
const Tab = ({ children }: TabPropsType) => children;
Tab.displayName = "Tab";
TabGroup.Tab = Tab;
