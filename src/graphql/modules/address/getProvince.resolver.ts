import { Context } from "../../../libs/graphql";
import { ghnService } from "../../../services/ghn/ghn.service";

let PROVINCES_CACHE: any[] = [];
const Query = {
  getProvince: async (root: any, args: any, context: Context) => {
    try {
      if (PROVINCES_CACHE.length === 0) {
        const provinces = await ghnService.getProvinces();
        PROVINCES_CACHE = provinces.map((p) => ({
          id: p.ProvinceID,
          name: p.ProvinceName,
          code: p.Code,
        }));
      }
      return PROVINCES_CACHE;
    } catch (error) {
      console.error("Error getting provinces:", error);
      throw new Error("Failed to fetch provinces");
    }
  },
};

export default {
  Query,
};
