import { OrderCode } from "./orderCode";

export default describe("Order Code", () => {
  it("should match order code", () => {
    const description = `CUSTOMER MBVCB OD3132OD753897 099917 OD 4 B7 H4   E7 M M CT tu 0331000473563 TRAN TRONG HI EU toi 0000100909999 TRAN TRONG HIE U Ngan hang Quan Doi  MB  Trace 099`;
    const orderCode = OrderCode.getOrderCodeFromText(description);
    expect(orderCode).toEqual("OD4B7H4E7MM");
  });
});
