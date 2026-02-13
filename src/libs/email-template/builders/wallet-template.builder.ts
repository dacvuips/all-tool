import { TemplateBuilder } from "../email-template.builder";

export class WalletTemplatePayload {
  siteTitle: string;
  siteDescription?: string;
  websiteLink?: string;
  logoUrl: string;
  recipientName: string;
  transactionId: string;
  transactionDate: string;
  transactionAmount: string;
  transactionDescription: string;
}

export class WalletTemplateBuilder extends TemplateBuilder<WalletTemplatePayload> {
  constructor() {
    super("wallet");
  }
}
