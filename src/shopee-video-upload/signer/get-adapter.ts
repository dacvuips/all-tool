/**
 * Factory chọn adapter theo env SHOPEE_SIGNER_ADAPTER.
 */
import { shopeeUploadConfig } from "../config";
import { NativeSignerAdapter } from "./adapters/native.signer";
import { StubSignerAdapter } from "./adapters/stub.signer";
import { ISignerAdapter } from "./signer.interface";

let cached: ISignerAdapter | null = null;

export function getSignerAdapter(): ISignerAdapter {
  if (cached) return cached;
  cached =
    shopeeUploadConfig.signerAdapter === "native"
      ? new NativeSignerAdapter()
      : new StubSignerAdapter();
  return cached;
}

/** Test helper — reset cache khi đổi adapter */
export function resetSignerAdapterCache(): void {
  cached = null;
}
