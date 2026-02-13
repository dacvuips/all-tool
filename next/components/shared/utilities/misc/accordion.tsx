import { MutableRefObject, useMemo, useRef } from "react";
import { useUUID } from "../../../../lib/hooks/useUUID";

interface Props extends ReactProps {
  isOpen: boolean;
}
export function Accordion(props: Props) {
  const ref: MutableRefObject<HTMLDivElement> = useRef();
  const id = useUUID();
  const maxHeight = useMemo(
    () => (ref.current && props.isOpen ? ref.current?.scrollHeight * 10 + "px" : "0"),
    [props.isOpen, ref.current?.scrollHeight]
  );

  return (
    <div
      id={id}
      className={`relative h-max transition-all overflow-hidden ${props.className || ""}`}
      ref={ref}
      style={{
        maxHeight: props.isOpen ? maxHeight : 0,
      }}
    >
      {props.children}
    </div>
  );
}
