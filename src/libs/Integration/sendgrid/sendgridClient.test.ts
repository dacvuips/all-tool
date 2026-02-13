import { SendgridClient } from "./sendgridClient";

export default describe("sendgridClient", () => {
  it("should send email", async () => {
    const msg = {
      to: "diepmyduong@gmail.com", // Change to your recipient
      from: "midmanvn@gmail.com", // Change to your verified sender
      subject: "Sending with SendGrid is Fun",
      text: "and easy to do anywhere, even with Node.js",
      html: "<strong>and easy to do anywhere, even with Node.js</strong>",
    };
    const result = await SendgridClient.send(msg);
    console.log(result);
    expect(result).toBeDefined();
  });
});
