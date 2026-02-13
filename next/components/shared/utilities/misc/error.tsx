import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { BiErrorCircle } from "react-icons/bi";
import { Button } from "../form";

interface ErrorCatcherProps extends ReactProps {
  onError?: (error, info) => any;
  fallback?: ({ error, resetErrorBoundary }) => JSX.Element;
}
export function ErrorCatcher({ onError = () => {}, fallback, ...props }: ErrorCatcherProps) {
  return (
    <ErrorBoundary FallbackComponent={fallback || FallbackComponent} onError={onError}>
      {props.children}
    </ErrorBoundary>
  );
}

function FallbackComponent({ error, resetErrorBoundary }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-col items-center w-full py-6 col-span-full">
        <i className="text-4xl text-danger">
          <BiErrorCircle />
        </i>
        <div className="mt-3 text-xl font-bold text-gray-700">{t("Có lỗi xảy ra")}</div>
        <div className="flex gap-2 mt-2">
          <Button primary text={t("Tải lại mục này")} onClick={resetErrorBoundary} />
          <Button
            className="bg-white"
            outline
            text={t("Chi tiết lỗi")}
            onClick={() => alert(error)}
          />
        </div>
      </div>
    </>
  );
}
