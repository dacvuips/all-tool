import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import logger from "../../helpers/logger";
export abstract class TemplateBuilder<Payload> {
  private _template: string;
  private _compiledTemplate: handlebars.TemplateDelegate<Payload>;
  protected logger = logger.child({ _reqId: this.constructor.name });

  constructor(private _templateName?: string) {
    // find email template from public/email folder
    // if not found, throw error
    // if found, read file and assign to this._template
    this.loadTemplate();
  }

  private loadTemplate() {
    // load template from the sample folder
    const templatePath = this.templatePath();

    if (fs.existsSync(templatePath)) {
      this._template = fs.readFileSync(templatePath, "utf-8");
      this._compiledTemplate = handlebars.compile(this._template);
    } else {
      throw new Error("Template not found. " + templatePath);
    }
  }

  private templatePath() {
    // const templatePath = path.resolve(__dirname, "./templates/" + this._templateName + ".hbs");
    const templatePath = "public/email/" + this._templateName + ".hbs";
    return templatePath;
  }

  build(payload?: Payload) {
    return this._compiledTemplate(payload);
  }
}
