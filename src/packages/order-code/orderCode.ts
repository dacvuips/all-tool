import { OrderIdShort } from "../order-id";

export namespace OrderCode {
  export function generate() {
    const prefix = "OD";
    const suffix = "MM";
    const code = OrderIdShort.generate();
    return `${prefix}${code}${suffix}`;
  }
  export function mPointGenerate() {
    const prefix = "OD";
    const suffix = "MP";
    const code = OrderIdShort.generate();
    return `${prefix}${code}${suffix}`;
  }
  export function getOrderCodeFromText(text: string) {
    // remove all space and convert to uppercase
    const textWithoutSpace = text.replace(/\s/g, "").toUpperCase();
    // find order codes
    const orderCodes = textWithoutSpace.match(/OD[A-Z0-9]{7}MM/g) || [];

    for (const orderCode of orderCodes) {
      const body = orderCode.slice(2, 9);
      if (OrderIdShort.validate(body)) {
        return orderCode;
      }
    }
    return null;
  }
}
