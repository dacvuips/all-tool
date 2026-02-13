import { SMS } from "../sms";

export default describe("SMS", () => {
  test("Send SMS V2", async () => {
    const phone = "+84916968263";
    const message = "Test SMS V2";

    const result = await SMS.send(phone, message);
    console.log(result);
    expect(result).toBeDefined();
  });
});
