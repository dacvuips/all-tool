import { CustomerModel } from "../dal/customer";

class CustomerService {
  async initCustomer() {
    return await CustomerModel.findOneAndUpdate(
      {
        code: "CUST-001",
      },
      {
        $setOnInsert: {
          name: "John Doe",
          email: "diepmyduong@gmail.com",
          phoneNumber: "0123456789",
        },
      },
      { new: true, upsert: true }
    );
  }
}
