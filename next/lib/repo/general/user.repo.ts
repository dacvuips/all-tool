import { t } from "../../functions/i18n";
import { Authority } from "../authority/authority.repo";
import { BaseModel, CrudRepository } from "../crud.repo";
import { PartnerConfig, UserBanks, UserGender, UserStatus } from "../types";

export interface User extends BaseModel {
  uid: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  avatar: string;
  province: string;
  district: string;
  ward: string;
  provinceId: string;
  districtId: string;
  wardId: string;
  role: "ADMIN" | "STAFF" | "PARTNER";
  unseenNotify: number;
  psid: string;
  subscriber: SubscriberInfo;
  scopes: string[];
  authorityId: string;
  authorityIds: string[];
  authority?: Authority; // Phân quyền
  code: string;
  birthday: Date;
  gender: UserGender;

  position: string;
  status: UserStatus;
  banks: UserBanks[];
  gameIdsPermission: string[];
  partnerGroupId: string;
  root: boolean;
}
interface SubscriberInfo {
  id: string;
  psid: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  locale: string;
  profilePic: string;
  partnerGroupId: string;
  isPartnerGroupOwner: boolean;
}
export class UserRepository extends CrudRepository<User> {
  apiName: string = "User";
  displayName: string = t("tài khoản");
  shortFragment: string = this.parseFragment(`
    id: String
    uid: string
    email: string
    name: string
    phone: string
    wardId: string
    role: 'ADMIN' | 'STAFF'
    createdAt: DateTime
    updatedAt: DateTime
    status:String
    banks:UserBank
    isPartnerGroupOwner:Boolean
    gameIdsPermission: [String]
    root
    
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    
    email: string
    avatar:string
    name: string
    phone: string
    wardId: string
    role: 'ADMIN' | 'STAFF'
    createdAt: DateTime
    updatedAt: DateTime
    scopes: [String]
    authorityId:string
    authorityIds: string[]
    address
    code:string
    birthday: Date
    gender: UserGender
    status:String
    position: string
    banks:UserBanks
    root
    authority {
      id: String
      name: String
      data {
        code: String
        name: String
        readOnly: Boolean
        checked: Boolean
        features {
          code: String
          name: String
          readOnly: Boolean
          checked: Boolean
          scopes {
            code: String
            name: String
            checked: Boolean
            readOnly: Boolean
          }: [AuthorityScope]
        }: [AuthorityFeature]
      }: [AuthorifyGroup]
    }: UserAuthority
    gameIdsPermission: [String]
    partnerGroupId

  `);

  // for firebase
  async login(token): Promise<{ user: User; token: string }> {
    return await this.mutate({
      mutation: `login(idToken: $idToken) { user { ${this.fullFragment} } token }`,
      variablesParams: `($idToken: String!)`,
      options: {
        variables: { idToken: token },
      },
    }).then((res) => res.data.g0);
  }
  async logout() {
    return await this.mutate({
      mutation: `logout`,
    });
  }
  // fore server username
  async userGetMe() {
    return await this.query({
      query: `userGetMe { ${this.fullFragment} }`,
    }).then((res) => res.data.g0 as User);
  }

  // for firebase

  async updateUserPassword(id: string, password: string) {
    return this.mutate({
      mutation: `updateUserPassword(id: $id, password: $password) { id }`,
      variablesParams: `($id: ID!, $password: String!)`,
      options: {
        variables: { id, password },
      },
    }).then((res) => res.data.g0);
  }
  async userChangePassword(idToken: string, password: string) {
    return this.mutate({
      mutation: `userChangePassword(idToken: $idToken, password: $password) { id }`,
      variablesParams: `($idToken: String!, $password: String!)`,
      options: {
        variables: { idToken, password },
      },
    }).then((res) => res.data.g0);
  }

  async loginWithUsernamePassword(username: string, password: string) {
    return this.mutate({
      mutation: `loginWithUsernamePassword(username: $username, password: $password) { user { ${this.fullFragment} } token }`,
      variablesParams: `($username: String!, $password: String!)`,
      options: {
        variables: { username, password },
      },
    }).then((res) => res.data.g0 as { user: User; token: string });
  }

  async activeUser(userId: string) {
    return await this.mutate({
      mutation: `activeUser(userId: "${userId}") `,
    }).then((res) => res.data.g0 as User);
  }

  async blockUser(userId: string) {
    return await this.mutate({
      mutation: `blockUser(userId: "${userId}") `,
    }).then((res) => res.data.g0 as User);
  }

  async getPartnerConfig(partnerId: string) {
    return await this.query({
      query: `getPartnerConfig(partnerId: "${partnerId}")`,
    }).then((res) => res.data.g0 as PartnerConfig);
  }

  async setPartnerConfig(partnerId: string, config: PartnerConfig) {
    return await this.mutate({
      mutation: `setPartnerConfig(partnerId: "${partnerId}", config: $config)`,
      variablesParams: `($config: PartnerConfigInput!)`,
      options: {
        variables: { config },
      },
    }).then((res) => res.data.g0 as PartnerConfig);
  }
  async getUserBanks(userId: string) {
    return await this.query({
      query: `getUserBanks(userId: "${userId}")`,
    }).then((res) => res.data.g0 as UserBanks[]);
  }
  async setUserBanks(userId: string, banks: UserBanks[]) {
    return await this.mutate({
      mutation: `setUserBanks(userId: "${userId}",  banks: $banks)`,
      variablesParams: `($banks: [UserBanksInput]!)`,
      options: {
        variables: { banks },
      },
    }).then((res) => res.data.g0 as boolean);
  }

  async userLoginShop(shopId: string) {
    return this.mutate({
      mutation: `accessUserLoginShop(shopId:"${shopId}")`,
    }).then(
      (res) =>
        res.data.g0 as {
          shopId: string;
        }
    );
  }

  async changeAccountUserFormShop() {
    return this.mutate({
      mutation: `changeAccountUserFormShop`,
    }).then((res) => res.data.g0);
  }
}

export const UserService = new UserRepository();

export const SCOPES: Option[] = [{ value: "post", label: "Quản lý bài đăng" }];
