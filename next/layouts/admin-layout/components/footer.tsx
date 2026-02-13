import getConfig from "next/config";

const { publicRuntimeConfig } = getConfig();
export function Footer({ className = "" }) {
  return (
    <>
      <footer
        className={`w-full flex justify-center pl-3 items-center text-gray-600 mt-auto ${className}`}
      >
        {`v${publicRuntimeConfig.version} © ${new Date().getFullYear()}`}
      </footer>
    </>
  );
}
