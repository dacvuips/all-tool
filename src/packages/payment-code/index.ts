export namespace PaymentCode {
  export function generate() {
    const prefix = "PM";
    const suffix = "XM";
    const code = Math.random().toString(36).substring(2, 16).toUpperCase();
    return `${prefix}${code}${suffix}`;
  }
}
