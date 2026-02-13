import moment from "moment-timezone";
import { WalletTemplateBuilder, WalletTemplatePayload } from "../../email-template";
import { DOMAIN, EMAIL_CONFIG, LOGO_URL } from "../../shared";
import { WalletEvent } from "../events";
import { EventConsumer } from "../shared";
import { SendgridClient } from "../../Integration/sendgrid";
import _ from "lodash";
import logger from "../../../helpers/logger";
import { IWalletTransaction, WalletTransactionTypeEnum } from "../../dal/walletTransaction";

export class WalletChangeEmailConsumer extends EventConsumer<WalletEvent> {
  private logger = logger.child({ _reqId: this.constructor.name });
  private templateBuilder = new WalletTemplateBuilder();
  constructor(
    private config: {
      to: string;
      from?: string;
      subject?: string;
    }
  ) {
    super();

    this.config = _.defaultsDeep(config, {
      from: EMAIL_CONFIG.from,
      subject: `Midman - Biến động số dư mPoint`,
    });
  }

  transform(event: WalletEvent): WalletTemplatePayload {
    return {
      siteTitle: `Midman - Biến động số dư mPoint`,
      siteDescription: `Thông báo thay đổi biến động số dư mPoint`,
      logoUrl: LOGO_URL,
      websiteLink: DOMAIN,
      recipientName: event.ownerName,
      transactionAmount: event.transcation.amount.toLocaleString() + ` Đồng`,
      transactionDate: moment(event.transcation.createdAt).format("DD/MM/YYYY HH:mm:ss"),
      transactionId: event.transcation.code,
      transactionDescription:
        this.getTransactionDescription(event.transcation) + ". " + event.transcation.description,
    };
  }
  async consume(event: WalletEvent) {
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

  private getTransactionDescription(transaction: IWalletTransaction) {
    switch (transaction.type) {
      case WalletTransactionTypeEnum.DEPOSIT:
        return "Giao dịch nạp tiền";
      case WalletTransactionTypeEnum.WITHDRAW:
        return "Giao dịch rút tiền";
      case WalletTransactionTypeEnum.EXCHANGE_FEE:
        return "Giao dịch phí trao đổi";
      case WalletTransactionTypeEnum.ADJUST_BALANCE:
        return "Giao dịch điều chỉnh số dư";
      case WalletTransactionTypeEnum.MANAGE_COST:
        return "Giao dịch quản lý chi phí";
      case WalletTransactionTypeEnum.MANAGE_COMMISSION:
        return "Giao dịch quản lý hoa hồng";
      default:
        return "Loại giao dịch không xác định";
    }
  }
}
