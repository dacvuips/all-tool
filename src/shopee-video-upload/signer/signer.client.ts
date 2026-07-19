/**
 * Client gọi signer qua HTTP nội bộ (dễ tách process sau).
 * Không hardcode credit.toolshopee.vn.
 */
import axios from "axios";
import { shopeeUploadConfig } from "../config";
import {
  SignerMeResult,
  SignerSignRequest,
  SignerSignResult,
  SignerTokenResult,
} from "./signer.interface";

function headers() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": shopeeUploadConfig.signerApiKey,
  };
}

export class SignerClient {
  constructor(private readonly baseUrl = shopeeUploadConfig.signerBaseUrl) {}

  async sign(req: SignerSignRequest): Promise<SignerSignResult> {
    const { data } = await axios.post<SignerSignResult>(`${this.baseUrl}/sign`, req, {
      headers: headers(),
      timeout: 20000,
      validateStatus: () => true,
    });
    return data;
  }

  async generateToken(opts?: {
    cookie?: string;
    country?: string;
  }): Promise<SignerTokenResult> {
    const { data } = await axios.post<SignerTokenResult>(
      `${this.baseUrl}/generate-token`,
      opts || {},
      {
        headers: headers(),
        timeout: 20000,
        validateStatus: () => true,
      }
    );
    return data;
  }

  async me(): Promise<SignerMeResult> {
    const { data } = await axios.get<SignerMeResult>(`${this.baseUrl}/me`, {
      headers: headers(),
      timeout: 10000,
      validateStatus: () => true,
    });
    return data;
  }
}

export const signerClient = new SignerClient();
