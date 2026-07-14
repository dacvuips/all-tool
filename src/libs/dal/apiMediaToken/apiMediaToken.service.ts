import { CRUDService } from "../../../base/crudService";
import { CustomerModel } from "../customer/customer.model";
import { ApiMediaTokenModel } from "./apiMediaToken.model";

class ApiMediaTokenService extends CRUDService(ApiMediaTokenModel) {
  async fetch(queryInput: any, options: any = {}) {
    const input = { ...(queryInput || {}) };
    const search = typeof input.search === "string" ? input.search.trim() : "";

    if (search) {
      const cleanSearch = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const customers = await CustomerModel.find(
        { email: { $regex: cleanSearch, $options: "i" } },
        { _id: 1 }
      )
        .limit(200)
        .lean();

      const customerIds = customers.map((c) => c._id);
      if (!input.filter) input.filter = {};

      if (input.filter.customerId != null) {
        const raw = input.filter.customerId;
        const existingId = typeof raw === "object" && raw.$oid ? raw.$oid : raw;
        const matched = customerIds.some((id) => String(id) === String(existingId));
        if (!matched) {
          input.filter.customerId = { $in: [] };
        }
      } else {
        input.filter.customerId = { $in: customerIds };
      }

      delete input.search;
    }

    return super.fetch(input, options);
  }
}

const apiMediaTokenService = new ApiMediaTokenService();
export { apiMediaTokenService };
