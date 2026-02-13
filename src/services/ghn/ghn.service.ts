import axios from "axios";
import { credentialService } from "../../libs/dal/credential";
import { decryptProviderSecret } from "../../packages/encryption";

export interface GHNProvince {
  ProvinceID: number;
  ProvinceName: string;
  Code: string;
}

export interface GHNDistrict {
  DistrictID: number;
  DistrictName: string;
  ProvinceID: number;
  Code: string;
}

export interface GHNWard {
  WardCode: string;
  WardName: string;
  DistrictID: number;
}

class GHNService {
  private apiUrl: string;
  private token: string;
  private cachedToken: string | null = null;
  constructor() {
    this.apiUrl = "https://online-gateway.ghn.vn/shiip/public-api";
  }

  private async getHeaders() {
    const token = await this.getToken();
    return {
      "Content-Type": "application/json",
      Token: token,
    };
  }

  // Method to get token from credential service with caching
  private async getToken(): Promise<string> {
    // Return cached token if available
    if (this.cachedToken) {
      return this.cachedToken;
    }

    const ghnCredential = (await credentialService.findAll({ limit: 1 }))[0]?.ghnToken;

    if (!ghnCredential?.active) {
      throw new Error("GHN credential is not active in credentials");
    }

    if (!ghnCredential.value) {
      throw new Error("GHN token is missing in credentials");
    }

    // Cache the decrypted token
    this.cachedToken = decryptProviderSecret(ghnCredential.value);
    return this.cachedToken;
  }

  async getProvinces(): Promise<GHNProvince[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/master-data/province`, {
        headers: await this.getHeaders(),
      });

      if (response.data && response.data.code === 200) {
        return response.data.data;
      }

      throw new Error(response.data?.message || "Failed to fetch provinces");
    } catch (error) {
      console.error("Error fetching provinces from GHN:", error);
      throw error;
    }
  }

  async getDistricts(provinceId: number): Promise<GHNDistrict[]> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/master-data/district`,
        { province_id: provinceId },
        {
          headers: await this.getHeaders(),
        }
      );

      if (response.data && response.data.code === 200) {
        return response.data.data;
      }

      throw new Error(response.data?.message || "Failed to fetch districts");
    } catch (error) {
      console.error("Error fetching districts from GHN:", error);
      throw error;
    }
  }

  async getWards(districtId: number): Promise<GHNWard[]> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/master-data/ward`,
        { district_id: districtId },
        {
          headers: await this.getHeaders(),
        }
      );

      if (response.data && response.data.code === 200) {
        return response.data.data;
      }

      throw new Error(response.data?.message || "Failed to fetch wards");
    } catch (error) {
      console.error("Error fetching wards from GHN:", error);
      throw error;
    }
  }
}

export const ghnService = new GHNService();
