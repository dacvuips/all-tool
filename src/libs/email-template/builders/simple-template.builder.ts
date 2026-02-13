import { TemplateBuilder } from "../email-template.builder";

export type SimpleTemplatePayload = {
  siteTitle: string;
  siteDescription?: string;
  websiteLink?: string;
  logoUrl: string;
  title: string;
  content: string;
};

export class SimpleTemplateBuilder extends TemplateBuilder<SimpleTemplatePayload> {
  constructor() {
    super("simple");
  }
}
