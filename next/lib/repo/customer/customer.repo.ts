import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { CustomerIntro, CustomerStatusEnum, CustomerTimes } from "../types";
export enum SubscriptionPlanEnum {
  FREE = "free",
  TRIAL = "trial",
  BASIC = "basic",
  STANDARD = "standard",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
}

export type GooglePackage = {
  subscription?: SubscriptionPlanEnum;
  videoCount?: number;
  videoLimit?: number;
  imageCount?: number;
  imageLimit?: number;
  requestCount?: number;
  requestLimit?: number;
  textCreditCount?: number;
  textCreditLimit?: number;
  imageStreamCount?: number;
  videoStreamCount?: number;
  expiryPackageDate?: Date;
};

export type GeneratedCustomAPI = {
  active?: boolean;
  endpoint?: string;
  APIKey?: string;
};

export interface Customer extends BaseModel {
  code?: string; // Mã khách hàng
  name?: string; // Tên khách hàng
  uid?: string; // Mã UID Firebase
  phoneNumber?: string; // Số điện thoại
  email?: string; // Email
  address?: string; // Địa chỉ
  avatarUrl?: string; // Ảnh đại diện
  status?: CustomerStatusEnum; // Trạng thái
  birthday?: Date; // Ngày sinh
  times?: CustomerTimes; // Lần mua hàng
  rewardPoint?: number; //Điểm thưởng
  bankVerifiedId?: string; // Ngân hàng đã xác thực
  hasReward?: boolean; // Có thưởng
  hasActivatedTrial?: boolean; // Đã kích hoạt gói dùng thử
  acceptedTermsOfService?: boolean; // Đã chấp nhận điều khoản sử dụng dịch vụ
  intro?: CustomerIntro; // giới thiệu
  province?: string;
  district?: string;
  ward?: string;
  googlePackage?: GooglePackage; // Gói Google
  generatedCustomAPI?: GeneratedCustomAPI;
}
export class CustomerRepository extends CrudRepository<Customer> {
  apiName: string = "Customer";
  displayName: string = t("khách hàng");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    code: String
    name: String
    phoneNumber: String
    email: String
    address: String
    avatarUrl: String
    status: String
    birthday: DateTime
    times {
      registedAt: DateTime
      lastLoginAt: DateTime
      lastOrderAt: DateTime
      emailVerifiedAt: DateTime
    }
    rewardPoint: Int
    bankVerifiedId:String
    hasActivatedTrial
    acceptedTermsOfService
    googlePackage {
      subscription: String
      videoCount: Int
      videoLimit: Int
      imageCount: Int
      imageLimit: Int
      requestCount: Int
      requestLimit: Int
      textCreditCount: Int
      textCreditLimit: Int
      imageStreamCount: Int
      videoStreamCount: Int
      expiryPackageDate: DateTime
    }
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    code: String
    name: String
    phoneNumber: String
    email: String
    address: String
    avatarUrl: String
    status: String
    birthday: DateTime
    times {
      registedAt: DateTime
      lastLoginAt: DateTime
      lastOrderAt: DateTime
      emailVerifiedAt: DateTime
    }
    rewardPoint: Int
    bankVerifiedId:String
    hasReward
    hasActivatedTrial
    acceptedTermsOfService
    province: String
    district: String
    ward: String
    googlePackage {
      subscription: String
      videoCount: Int
      videoLimit: Int
      imageCount: Int
      imageLimit: Int
      requestCount: Int
      requestLimit: Int
      textCreditCount: Int
      textCreditLimit: Int
      imageStreamCount: Int
      videoStreamCount: Int
      expiryPackageDate: DateTime
    }
    generatedCustomAPI {
      active: Boolean
      endpoint: String
      APIKey: String
    }
  `);

  async checkCustomerPhone(phoneNumber: string) {
    return await this.query({
      query: `checkCustomerPhone(phone: "${phoneNumber}")`,
    }).then((res) => res.data.g0);
  }
  async checkCustomerEmail(email: string) {
    return await this.query({
      query: `checkCustomerEmail(email: "${email}")`,
    }).then((res) => res.data.g0);
  }

  async customerIntroOrder() {
    return await this.mutate({
      mutation: `customerIntroOrder`,
    }).then((res) => res.data.g0);
  }
  async customerIntroCard() {
    return await this.mutate({
      mutation: `customerIntroCard`,
    }).then((res) => res.data.g0);
  }
  async customerAcceptTermsOfService() {
    return await this.mutate({
      mutation: `customerAcceptTermsOfService`,
    }).then((res) => res.data.g0);
  }
  async customerRegister(data: {
    firebaseToken: string;
    name: string;
    email: string;
    password: string;
    shopName: string;
    introduceCode?: string;
  }) {
    return await this.mutate({
      mutation: `customerRegister(input: $input)`,
      variablesParams: "($input: CustomerRegisterInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async customerRegisterWithEmail(data: {
    name: string;
    email: string;
    password: string;
    introduceCode?: string;
  }) {
    return await this.mutate({
      mutation: `customerRegisterWithEmail(input: $input)`,
      variablesParams: "($input: CustomerRegisterWithEmailInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async customerLoginWithEmail(data: { accessToken: string; pw: string }) {
    return await this.mutate({
      mutation: `customerLoginWithEmail(input: $input)`,
      variablesParams: "($input: CustomerLoginWithEmailInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async customerLogin(phone: string, password: string) {
    return this.mutate({
      mutation: `customerLogin(phone: "${phone}", password: "${password}"){customer{${this.fullFragment}}accessToken}`,
    }).then((res) => res.data.g0);
  }
  async customerLoginWithGoogle(accessToken: string) {
    return this.mutate({
      mutation: `customerLoginWithGoogle(accessToken: "${accessToken}"){customer{${this.fullFragment}}}`,
    }).then((res) => res.data.g0);
  }
  async customerGetInfo() {
    return this.query({
      query: `customerGetInfo`,
    }).then((res) => res.data.g0);
  }

  async customerUpdateProfile(data: {
    name?: string;
    email?: string;
    avatarUrl?: string;
    address?: string;
    province?: string;
    district?: string;
    ward?: string;
  }) {
    return this.mutate({
      mutation: `customerUpdateProfile(input: $input)`,
      variablesParams: "($input: CustomerUpdateProfileInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async customerUpdatePhoneNumberAndPassword(data: { password: string; introduceCode?: string }) {
    return this.mutate({
      mutation: `customerUpdatePhoneNumberAndPassword(input: $input)`,
      variablesParams: "($input: CustomerUpdatePhoneNumberAndPasswordInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async customerChangePassword(data: { idToken: string; password: string }) {
    return this.mutate({
      mutation: `customerChangePassword(input: $input)`,
      variablesParams: "($input: CustomerChangePasswordInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }
  async customerChangePasswordUser(data: { customerId: string; newPassword: string }) {
    return this.mutate({
      mutation: `customerChangePasswordByUser(input: $input)`,
      variablesParams: "($input: CustomerChangePasswordByUserInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async customerResetPassword(data: { firebaseToken: string; newPassword: string }) {
    return this.mutate({
      mutation: `customerResetPassword(input: $input)`,
      variablesParams: "($input: CustomerResetPasswordInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async customerGetEmail() {
    return this.query({
      query: `customerGetEmail`,
    }).then((res) => res.data.g0);
  }

  async customerUpdatePackage(data: { customerId: string; subscription: string }) {
    return this.mutate({
      mutation: `customerUpdatePackage(customerId: "${data.customerId}", subscription: "${data.subscription}") { ${this.shortFragment} }`,
    }).then((res) => res.data.g0);
  }

  async customerUpdatePackageField(data: {
    customerId: string;
    fieldData: {
      videoLimit?: number;
      imageLimit?: number;
      videoCount?: number;
      imageCount?: number;
      requestCount?: number;
      requestLimit?: number;
      textCreditCount?: number;
      textCreditLimit?: number;
      imageStreamCount?: number;
      videoStreamCount?: number;
      expiryPackageDate?: string;
    };
  }) {
    return this.mutate({
      mutation: `customerUpdatePackageField(customerId: "${data.customerId}", data: $data) { ${this.shortFragment} }`,
      variablesParams: "($data: CustomerUpdatePackageFieldInput!)",
      options: {
        variables: {
          data: data.fieldData,
        },
      },
    }).then((res) => res.data.g0);
  }

  async accessCustomer() {
    return this.mutate({
      mutation: `accessCustomer`,
    }).then((res) => res.data.g0);
  }
  async customerCreditPoint(data: { action: "add" | "sub"; customerId: string; point: number }) {
    return this.query({
      query: `customerCreditPoint(action: "${data.action}", customerId: "${data.customerId}", point: ${data.point})`,
    }).then((res) => res.data.g0);
  }
}

export const CustomerService = new CustomerRepository();
