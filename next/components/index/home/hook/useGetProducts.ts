import { useEffect, useState } from "react";

import { BusinessTypeEnum } from "../../../../lib/repo/types";
interface UseGetProducts {
  businessType: BusinessTypeEnum;
  page: number;
  setPage: (value: number) => void;
}
export const useGetProducts = ({ businessType, page, setPage }: UseGetProducts) => {
  const [products, setProducts] = useState<any>([]);
  const [loading, setLoading] = useState<boolean>();
  const [total, setTotal] = useState<number>();

  useEffect(() => {
    GetProduct({ businessType, page, setPage });
  }, [businessType, page]);

  const GetProduct = async ({ businessType, setPage }: UseGetProducts) => {
    setLoading(true);
    // await AffiliateProductsService.getAllowSaleAffiliateProducts({
    //   query: { limit: 20, filter: { businessType }, page },
    // })
    //   .then((res: any) => {
    //     const data = products?.length > 0 ? products?.concat(res.data) : res.data;

    //     const result = {
    //       ...res,
    //       data,
    //     };

    //     setProducts(result.data);
    //     setPage(res.pagination.page);
    //     setTotal(res.total);
    //     setLoading(false);
    //   })
    //   .catch(() => {
    //     setLoading(false);
    //   });
  };

  return { products, loading, total };
};
