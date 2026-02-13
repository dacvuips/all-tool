import i18n from "./i18n/i18n";

export const getFirebaseErrorMsg = (err: { code: string; message: string }) => {
  switch (err.code) {
    case "auth/email-already-exists":
      return i18n.t("Email đã tồn tại.");

    default:
      return err.message;
  }
};
