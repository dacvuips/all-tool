import logger from "../../../helpers/logger";

export abstract class BaseUsecase {
  protected readonly logger = logger.child({ _reqId: this.constructor.name });

  abstract execute(cmd: any): Promise<any>;
}
