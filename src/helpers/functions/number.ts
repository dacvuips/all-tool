import _ from "lodash";

export function abbreviateNumbers(data: number[], isComma: boolean) {
  const max = _.max(data);
  let min = max / 6;
  const suffixes = ["", `${"Ngàn"}`, `${"Triệu"}`, `${"Tỷ"}`, `${"Ngàn tỷ"}`];
  let suffixNum = 0;
  while (min >= 1000) {
    min /= 1000;
    suffixNum++;
  }

  const result =
    suffixNum > 0
      ? data.map((d) => {
          if (!isComma) {
            return (d / Math.pow(1000, suffixNum)).toPrecision(3);
          } else {
            return d;
          }
        })
      : data;
  return { data: result, suffix: suffixes[suffixNum] };
}
