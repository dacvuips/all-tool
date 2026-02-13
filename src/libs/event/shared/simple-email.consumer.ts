import logger from "../../../helpers/logger";
import { SimpleTemplateBuilder, SimpleTemplatePayload } from "../../email-template";
import { SendgridClient } from "../../Integration/sendgrid";
import { EventConsumer } from "./eventConsumer";

export abstract class SimpleEmailConsumer<Payload> extends EventConsumer<Payload> {
  protected logger = logger.child({ _reqId: this.constructor.name });
  private templateBuilder = new SimpleTemplateBuilder();

  constructor(
    private config: {
      from: string;
      to: string;
      subject: string;
    }
  ) {
    super();
  }

  abstract transform(event: Payload): SimpleTemplatePayload;
  async consume(event: Payload) {
    const payload = this.transform(event);
    const templateHtml = this.templateBuilder.build(payload);

    // this.logger.info("Sending email", {
    //   to: this.config.to,
    //   subject: this.config.subject,
    // });
    // Send email
    await SendgridClient.send({
      from: this.config.from,
      to: this.config.to,
      subject: this.config.subject,
      html: templateHtml,
    })
      .then(() => {
        this.logger.info("Email sent successfully", {
          to: this.config.to,
          subject: this.config.subject,
        });
      })
      .catch((err) => {
        this.logger.error("Error sending email", {
          to: this.config.to,
          subject: this.config.subject,
          err,
        });
      });
  }
}
