import { SimpleTemplateBuilder } from "./simple-template.builder";
import fs from "fs";
export default describe("SimpleTemplateBuilder", () => {
  it("should be able to build a simple template", () => {
    const builder = new SimpleTemplateBuilder();
    const template = builder.build({
      siteTitle: "Midman",
      siteDescription: "Midman is a platform for connecting buyers and sellers",
      websiteLink: "https://midman.com",
      logoUrl: "https://midman.com/logo.png",
      title: "Welcome to Midman",
      content: "Thank you for registering with Midman",
    });

    expect(template).toBeDefined();

    // write to file
    fs.writeFileSync("tmp/simple.html", template);
  });
});
