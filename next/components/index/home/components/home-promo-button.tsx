import Link from "next/link";
import { ReactNode } from "react";

const VARIANT_CLASS = {
  purple: "bg-purple border-purple text-white hover:bg-purple-dark hover:text-white",
  orange: "bg-orange border-orange text-white hover:bg-orange-dark hover:text-white",
  rose: "bg-rose border-rose text-white hover:bg-rose-dark hover:text-white",
} as const;

type HomePromoButtonProps = {
  href: string;
  text: string;
  icon?: ReactNode;
  variant: keyof typeof VARIANT_CLASS;
};

export function HomePromoButton({ href, text, icon, variant }: HomePromoButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 h-10 px-5 text-sm font-semibold rounded-full border transition-all ${VARIANT_CLASS[variant]}`}
    >
      {icon}
      <span>{text}</span>
    </Link>
  );
}
