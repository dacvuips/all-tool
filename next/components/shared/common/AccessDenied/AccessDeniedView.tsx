"use client";
import { memo } from "react";

import { useTranslation } from "react-i18next";

import { RiLock2Line } from "react-icons/ri";
import { Button } from "../../utilities/form";

interface AccessDeniedViewProps {
  onGoHome?: () => void;
}

const AccessDeniedView = memo(({ onGoHome }: AccessDeniedViewProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-5 size-full">
      <RiLock2Line size={"80px"} className="text-gray-500" />
      <span
        className="text-4xl font-bold text-transparent bg-clip-text"
        style={{
          backgroundImage: `linear-gradient(45deg, rgba(35,78,37,0.4) 20%, rgba(3,99,7,0.7) 80%)`,
        }}
      >
        {t("OOPS")}
      </span>
      <span className="text-24 text-primary">{t("Bạn không có quyền truy cập trang này.")}</span>
      <span>
        {t(
          "Bạn cần đăng nhập vào một tài khoản có quyền truy cập. Hãy thử chuyển đổi hoặc đăng nhập vào một tài khoản có quyền."
        )}
      </span>
      <Button onClick={onGoHome} primary>
        {t("Đến trang có quyền")}
      </Button>
    </div>
  );
});

export default AccessDeniedView;
