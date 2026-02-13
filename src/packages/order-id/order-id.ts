// Package Name: order-id
// Generate unique order id base on timestamp

import { t } from "../../helpers/functions/string";

export namespace OrderId {
  export function generate(date?: Date) {
    const timestamp = date || new Date();
    // random number with 6 digits
    const x = Math.floor(100000 + Math.random() * 900000).toString();

    // x: random number
    // MM: is month (01-12) will split to 2 digits
    // DD: is day (01-31) will split to 2 digits
    // HH: is hour (00-23) will split to 2 digits
    // YY: is year (00-99) will split to 2 digits

    // get YYMMDDHH format
    const D = timestamp.toISOString().slice(2, 13).replace(/-/g, "");
    // concat timestamp and random number with format `xMDxYMYxHHDxxx`
    const code = `${x[0]}${D[2]}${D[4]}${x[1]}${D[0]}${D[3]}${D[1]}${x[2]}${D[7]}${D[8]}${D[5]}${x[3]}${x[4]}${x[5]}`;
    // generate checksum number by loop through each character in code and sum
    const checksumNumber = checksum(code);
    // split
    return code + checksumNumber;
  }

  export function validate(code: string) {
    if (code.length != 15) {
      return false;
    }
    const checksumNumber = code.slice(14, 15);
    const codeWithoutChecksum = code.slice(0, 14);
    const checksumCalculated = checksum(codeWithoutChecksum);
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
        .map((i) => parseInt(i))
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
