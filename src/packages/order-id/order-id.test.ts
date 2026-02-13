import { OrderId } from "./order-id";

export default describe("order-id", () => {
  it("should generate order id", () => {
    const orderId = OrderId.generate();
    expect(orderId.length).toBe(15);
    const validate = OrderId.validate(orderId);
    expect(validate).toBe(true);
    const time = OrderId.getTime(orderId);
    const date = new Date();
    expect(time.getFullYear().toString()).toBe(date.getFullYear().toString());
    console.log("time", time);
    console.log("orderId", orderId);
  });

  it("should invalid order id", () => {
    const orderId = "123456789012345";
    const validate = OrderId.validate(orderId);
    expect(validate).toBe(false);
  });
});
