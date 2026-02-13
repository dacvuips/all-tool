import Link from "next/link";
import { RiHome3Line } from "react-icons/ri";

interface PropsType extends ReactProps {
  textClassName?: string;
  breadcrumbs: {
    href?: string;
    label: string;
  }[];
}
export function BreadCrumbs({ breadcrumbs, className = "", textClassName, ...props }: PropsType) {
  return (
    <div className={`text-sm flex flex-row flex-wrap   font-semibold ${className}`}>
      {breadcrumbs.map((breadcrumb, index) => (
        <span key={index}>
          {breadcrumb.href ? (
            <>
              <Link
                href={breadcrumb.href}
                className={`"text-gray-600" hover:underline transition-all duration-200 hover:text-primary`}
              >
                {index == 0 ? (
                  <RiHome3Line className="inline text-16" />
                ) : (
                  <span className={textClassName}>{breadcrumb.label}</span>
                )}
              </Link>
              <span className="px-1.5">/</span>
            </>
          ) : (
            <a className={"text-primary"}>
              <span className={textClassName}>{breadcrumb.label}</span>
            </a>
          )}
        </span>
      ))}
    </div>
  );
}
