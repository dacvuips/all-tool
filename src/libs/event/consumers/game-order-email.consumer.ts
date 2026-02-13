import { SimpleTemplatePayload } from "../../email-template";
import { DOMAIN, EMAIL_CONFIG, LOGO_URL } from "../../shared";
import { GameOrderEvent } from "../events/game-order.event";
import { SimpleEmailConsumer } from "../shared/simple-email.consumer";

export class GameOrderCreatedEmailConsumer extends SimpleEmailConsumer<GameOrderEvent> {
  constructor({ to }: { to: string }) {
    super({
      from: EMAIL_CONFIG.from,
      subject: "Midman - Thông báo đơn hàng",
      to: to,
    });
  }
  transform(event: GameOrderEvent): SimpleTemplatePayload {
    return {
      siteTitle: "Midman - Thông báo đơn hàng",
      title: `Đơn hàng đã được tiếp nhận.`,
      content: `Chúng tôi đã nhận được đơn hàng của bạn. Chúng tôi sẽ xem xét và liên hệ với bạn trong thời gian sớm nhất.\nMã đơn hàng: ${event.orderCode}`,
      logoUrl: LOGO_URL,
      websiteLink: DOMAIN,
    };
  }
}

export class GameOrderCanceledEmailConsumer extends SimpleEmailConsumer<GameOrderEvent> {
  constructor({ to }: { to: string }) {
    super({
      from: EMAIL_CONFIG.from,
      to: to,
      subject: "Midman - Thông báo đơn hàng",
    });
  }

  transform(event: GameOrderEvent): SimpleTemplatePayload {
    return {
      siteTitle: "Midman - Thông báo đơn hàng",
      title: `Đơn hàng đã bị hủy.`,
      content: `Rất tiếc, đơn hàng của bạn đã bị hủy. Vui lòng liên hệ với chúng tôi để biết thêm chi tiết.\n Mã đơn hàng: #${event.orderCode}`,
      logoUrl: LOGO_URL,
      websiteLink: DOMAIN,
    };
  }
}

export class GameOrderCompletedEmailConsumer extends SimpleEmailConsumer<GameOrderEvent> {
  constructor({ to }: { to: string }) {
    super({
      from: EMAIL_CONFIG.from,
      to: to,
      subject: "Midman - Thông báo đơn hàng",
    });
  }

  transform(event: GameOrderEvent): SimpleTemplatePayload {
    return {
      siteTitle: "Midman - Thông báo đơn hàng",
      title: `Đơn hàng đã hoàn thành.`,
      content: `Chúc mừng bạn đã hoàn thành đơn hàng. Bạn có thể truy cập vào đơn hàng của mình tại địa chỉ:\n${DOMAIN}\nMã đơn hàng: #${event.orderCode}`,
      logoUrl: LOGO_URL,
      websiteLink: DOMAIN,
    };
  }
}
