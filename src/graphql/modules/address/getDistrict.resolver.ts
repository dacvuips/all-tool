import { Context } from "../../../libs/graphql";
import { ghnService } from "../../../services/ghn/ghn.service";

const Query = {
  getDistrict: async (root: any, args: any, context: Context) => {
    const { provinceName } = args;

    if (!provinceName) {
      throw new Error("Province name is required");
    }

    try {
      // Get all provinces to find the province ID
      const provinces = await ghnService.getProvinces();
      const province = provinces.find(
        (p) => p.ProvinceName.toLowerCase() === provinceName.toLowerCase()
      );

      if (!province) {
        throw new Error("Province not found");
      }

      // Get districts by province ID
      const districts = await ghnService.getDistricts(province.ProvinceID);

      return districts.map((d) => ({
        id: d.DistrictID,
        name: d.DistrictName,
        provinceId: d.ProvinceID,
        code: d.Code,
      }));
    } catch (error) {
      console.error("Error getting districts:", error);
      throw new Error("Failed to fetch districts");
    }
  },
};

export default {
  Query,
};
