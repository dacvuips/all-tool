import sift from "sift";
import { IAuthority } from "../../../libs/dal/authority/authority.interface";

export class AuthorityHelper {
  constructor(public value: IAuthority) {}

  isParent(parentAuthorityId: string) {
    return sift({
      $or: [{ _id: parentAuthorityId }, { parentIds: { $in: [parentAuthorityId] } }],
    })(this.value);
  }
}
