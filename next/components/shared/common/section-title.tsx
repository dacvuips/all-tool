export function SectionTitle(props: ReactProps) {
  return (
    <div
      style={props.style}
      className={`font-bold uppercase text-primary bg-primary-light mr-2 inline pr-4 py-1 rounded-r-full text-sm ${
        props.className || ""
      }`}
    >
      {props.children}
    </div>
  );
}
