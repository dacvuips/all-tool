import { CRUDService } from "../../../base/crudService";
import { RecaptchaTokenModel } from "./recaptchaToken.model";

class RecaptchaTokenService extends CRUDService(RecaptchaTokenModel) {}

const recaptchaTokenService = new RecaptchaTokenService();
export { recaptchaTokenService };
