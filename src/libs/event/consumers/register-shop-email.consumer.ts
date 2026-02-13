import { SimpleTemplatePayload } from "../../email-template";
import { DOMAIN, EMAIL_CONFIG, LOGO_URL, SHOP_URL } from "../../shared";
import { ShopEvent } from "../events/shop.event";
import { SimpleEmailConsumer } from "../shared/simple-email.consumer";

export class RegisterShopEmailConsumer extends SimpleEmailConsumer<ShopEvent> {
  constructor({ to }: { to: string }) {
    super({
      from: EMAIL_CONFIG.from,
      subject: "Midman - Đăng ký cửa hàng",
      to: to,
    });
  }
  transform(event: ShopEvent): SimpleTemplatePayload {
    return {
      siteTitle: "Midman - Đăng ký cửa hàng",
      title: `Yêu cầu đăng ký cửa hàng đã được tiếp nhận.`,
      content: `Chúng tôi đã nhận được yêu cầu đăng ký cửa hàng của bạn. Chúng tôi sẽ xem xét và liên hệ với bạn trong thời gian sớm nhất.\nMã cửa hàng: ${event.shopCode}`,
      logoUrl: LOGO_URL,
      websiteLink: DOMAIN,
    };
  }
}

export class RegisterShopApprovedEmailConsumer extends SimpleEmailConsumer<ShopEvent> {
  constructor({ to }: { to: string }) {
    super({
      from: EMAIL_CONFIG.from,
      to: to,
      subject: "Midman - Đăng ký cửa hàng thành công",
    });
  }
  transform(event: ShopEvent) {
    return {
      siteTitle: "Midman - Đăng ký cửa hàng thành công",
      title: "Đăng ký cửa hàng thành công",
      content: `Chúc mừng bạn đã đăng ký cửa hàng thành công. Bạn có thể truy cập vào cửa hàng của mình tại địa chỉ: 
${SHOP_URL}`,
      logoUrl: LOGO_URL,
      websiteLink: DOMAIN,
    };
  }
}

export class RegisterShopRejectedEmailConsumer extends SimpleEmailConsumer<ShopEvent> {
  constructor({ to }: { to: string }) {
    super({
      from: EMAIL_CONFIG.from,
      to: to,
      subject: "Midman - Đăng ký cửa hàng không thành công",
    });
  }

  transform(event: ShopEvent): SimpleTemplatePayload {
    return {
      siteTitle: "Midman - Đăng ký cửa hàng không thành công",
      title: "Đăng ký cửa hàng không thành công",
      content: `Rất tiếc, yêu cầu đăng ký cửa hàng của bạn không được chấp nhận. Vui lòng liên hệ với chúng tôi để biết thêm chi tiết.`,
      logoUrl: LOGO_URL,
      websiteLink: DOMAIN,
    };
  }
}
