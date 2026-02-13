import { decryptProviderSecret, encryptProviderSecret } from "./encrypt-provider";

export default describe("encrypt-provider", () => {
  it("should encrypt and decrypt provider secret", () => {
    const text = "secret";
    const encrypted = encryptProviderSecret(text);
    const decrypted = decryptProviderSecret(encrypted);

    expect(encrypted.startsWith("mmsk.")).toBeTruthy();
    expect(decrypted).toEqual(text);
  });
});
