import { Context } from "../../../libs/graphql";
import { ghnService } from "../../../services/ghn/ghn.service";

const Query = {
  getWard: async (root: any, args: any, context: Context) => {
    const { districtName } = args;

    if (!districtName) {
      throw new Error("District name is required");
    }

    try {
      // Get all provinces to find districts
      const provinces = await ghnService.getProvinces();

      let district = null;
      for (const province of provinces) {
        const districts = await ghnService.getDistricts(province.ProvinceID);
        district = districts.find(
          (d) => d.DistrictName.toLowerCase() === districtName.toLowerCase()
        );
        if (district) break;
      }

      if (!district) {
        throw new Error("District not found");
      }

      // Get wards by district ID
      const wards = await ghnService.getWards(district.DistrictID);

      return wards.map((w) => ({
        id: w.WardCode,
        name: w.WardName,
        districtId: w.DistrictID,
      }));
    } catch (error) {
      console.error("Error getting wards:", error);
      throw new Error("Failed to fetch wards");
    }
  },
};

export default {
  Query,
};
