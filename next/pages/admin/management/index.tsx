import { useRouter } from "next/router";
import { useEffect } from "react";
import { getServerSideTranslationsProps } from "../../../lib/functions/locale";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/management/users");
  });
  return null;
}
export const getServerSideProps = getServerSideTranslationsProps();
