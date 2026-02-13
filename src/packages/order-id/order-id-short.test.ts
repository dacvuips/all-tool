import { OrderIdShort } from "./order-id-short";

export default describe("order-id", () => {
  it("should generate order id", () => {
    const orderId = OrderIdShort.generate();
    expect(orderId.length).toBe(7);
    const validate = OrderIdShort.validate(orderId);
    expect(validate).toBe(true);
    console.log("orderId", orderId);
  });

  it("should invalid order id", () => {
    const orderId = "RFTjMU9";
    const validate = OrderIdShort.validate(orderId);
    expect(validate).toBe(false);
  });
});
