import { DialogProps } from "../../../utilities/dialog/dialog";
import { CustomerLoginEmailTab } from "./customer-login-email-tab";
// import { CustomerLoginPhoneNumberTab } from "./customer-login-phone-number-tab";
interface Props extends DialogProps {}
export function CustomerLoginDialog({ ...props }: Props) {
  return (
    <>
      {/* <CustomerLoginPhoneNumberTab {...props} /> */}
      <CustomerLoginEmailTab {...props} />
    </>
  );
}
