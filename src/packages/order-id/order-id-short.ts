// Package Name: order-id
// Generate unique order id base on timestamp

import { t } from "../../helpers/functions/string";

export namespace OrderIdShort {
  export function generate() {
    // random 6 characters
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    // generate checksum number by loop through each character in code and sum
    const checksumNumber = checksum(code);
    // split
    return code + checksumNumber;
  }

  export function validate(code: string) {
    if (code.length != 7) {
      return false;
    }
    const checksumNumber = code.slice(6, 7);
    const checksumCalculated = checksum(code.slice(0, 6));
    return checksumNumber == checksumCalculated.toString();
  }

  export function getTime(code: string) {
    if (validate(code) == false) {
      throw new Error(t("Mã không hợp lệ"));
    }
    const MM = code[1] + code[5];
    const DD = code[2] + code[10];
    const YY = code[4] + code[6];
    const HH = code[8] + code[9];
    const timestamp = `20${YY}-${MM}-${DD}T${HH}:00:00.000Z`;
    return new Date(timestamp);
  }

  function checksum(code: string) {
    return (
      code
        .split("")
        .map((i) => i.charCodeAt(0))
        .reduce((a, b, i, l) => {
          if (i == 0) {
            return b;
          } else {
            // console.log("a", a, "b", b, "i", i, "l", l[i - 1]);
            return a + b + ((b + l[i - 1]) % 10);
          }
        }, 0) % 10
    );
  }
}
