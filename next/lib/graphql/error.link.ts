import { onError } from "apollo-link-error";
import { i18n } from "next-i18next";
import { UserService } from "../repo";
import { ClearCustomerToken, ClearUserToken } from "./auth.link";
var expiredTimeout;

export const ErrorLink = onError(({ graphQLErrors, networkError, forward }) => {
  let errorMessage = "";
  if (graphQLErrors) {
    console.log(graphQLErrors);
    graphQLErrors.map(({ message, locations, path }) => {
      console.error({ message: i18n.t(message), locations, path });
      errorMessage = `${i18n.t(message)}`;
    });
  }

  if (networkError) {
    const netErr = networkError as any;
    if (netErr.error && netErr.error.errors) {
      console.error(`[Network error]:`, netErr.error.errors[0].message);
      errorMessage = `[Network error]: ${netErr.error.errors[0].message}`;
      networkError.message = netErr.error.errors[0].message;
    } else {
      errorMessage = `[Network error]: ${networkError}`;
    }
  }

  if (errorMessage.includes(`[403]`)) {
    if (expiredTimeout) clearTimeout(expiredTimeout);
    expiredTimeout = setTimeout(() => {
      ClearCustomerToken();
      ClearUserToken();
      UserService.clearStore();
      UserService.logout();
      alert(i18n.t("Đã hết phiên làm việc. Vui lòng đăng nhập lại để tiếp tục sử dụng."));

      window.close();
      location.reload();
    }, 100);
  }
});
