import getConfig from "next/config";

const { publicRuntimeConfig } = getConfig();

export function Footer({ className, ...props }: ReactProps) {
  return (
    <footer className={`flex justify-center w-full h-full items-center border-t-0.5 ${className}`}>
      <div>{`Viet Theo Veo 3 © ${new Date().getFullYear()}${
        publicRuntimeConfig?.version ? " v" + publicRuntimeConfig?.version : ""
      }`}</div>
    </footer>
  );
}
