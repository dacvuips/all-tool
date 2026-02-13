import _ from "lodash";

export function convertPhone(phone: string, prefix: string) {
  const txt = "" + phone;

  return prefix + txt.trim().replace(/^84/, "+84").replace(/^81/, "+81").replace(/^82/, "+82");
}

export function isVietnamesePhoneNumber(number: string) {
  return /^\+84(3|5|7|8|9|1[2|6|8|9])+([0-9]{8})\b/.test(number);
}

export function parseStringWithInfo(str: string, context: any) {
  let messageText = "" + str;
  const stringRegex = /{{(.*?)}}/g;
  messageText = messageText.replace(stringRegex, (m: any, field: string) => {
    let str = _.get(context, field.trim());
    if (_.isString(str) || _.isNumber(str)) {
      str = JSON.stringify(str)
        .replace(/\\n/g, "\\n")
        .replace(/\\'/g, "\\'")
        .replace(/\\"/g, '\\"')
        .replace(/\\&/g, "\\&")
        .replace(/\\r/g, "\\r")
        .replace(/\\t/g, "\\t")
        .replace(/\\b/g, "\\b")
        .replace(/\\f/g, "\\f")
        .replace(/^\"(.*)\"$/g, "$1");
    } else if (_.isObject(str) || _.isBoolean(str)) {
      str = `<<Object(${JSON.stringify(str)})Object>>`;
    }
    return str || "";
  });
  return messageText.replace(
    /\:\"(?: +)?<<Object\((true|false|[\{|\[].*?[\}|\]])\)Object>>(?: +)?\"/g,
    ":$1"
  );
}

export function validCode(str: string) {
  return /^[a-zA-Z0-9_\+\-]{1,}$/.test(str);
}

export function t(str: any) {
  return str;
}

export function cleanText(str: any) {
  return _.trim(_.toString(str));
}
