import { Player } from "@lottiefiles/react-lottie-player";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../../components/shared/utilities/dialog/dialog";
import { Button } from "../../../components/shared/utilities/form";
import { useHomeLayoutContext } from "../provider/home-layout-provider";

export function SelectCategoryGlobalDialog({ ...props }) {
  return <SelectCategoryGlobalItem />;
}

const SelectCategoryGlobalItem = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { categoryGlobal, categoryGlobalList, setCategoryGlobal, setCategoryStorage } =
    useHomeLayoutContext();
  const [openSelectCategoryGlobal, setOpenSelectCategoryGlobal] = useState<boolean>(false);

  useEffect(() => {
    if (categoryGlobal === null) return;

    setOpenSelectCategoryGlobal(!categoryGlobal && categoryGlobalList?.length > 1 ? true : false);
  }, [categoryGlobal, categoryGlobalList]);

  const categoryButtons = useMemo(() => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        {categoryGlobalList?.map((item) => (
          <Button
            key={item.type}
            className="m-1 whitespace-nowrap"
            primary
            onClick={() => {
              setCategoryStorage({ categoryType: item.type });
              setOpenSelectCategoryGlobal(false);
              setCategoryGlobal(item.type);
              router.reload();
            }}
            text={`${t("Dịch vụ")} ${item.name}`}
          />
        ))}
      </div>
    );
  }, [categoryGlobalList]);

  return (
    <>
      <Dialog
        width={400}
        isOpen={openSelectCategoryGlobal}
        slideFromBottom={"none"}
        hasCloseIcon={false}
        onOverlayClick={() => {}}
      >
        <Dialog.Body>
          <div className="flex flex-col items-center gap-4">
            <Player
              autoplay
              loop
              src={`/assets/lottie/welcome.json`}
              style={{ height: "240px", width: "240px", marginTop: "-120px" }}
            ></Player>
            <div className="text-center">
              {t(
                "Quý khách vui lòng chọn dịch vụ, việc chọn dịch vụ để chúng tôi phục vụ quý khách tốt hơn!"
              )}
            </div>
            {categoryButtons}
          </div>
        </Dialog.Body>
      </Dialog>
    </>
  );
};
