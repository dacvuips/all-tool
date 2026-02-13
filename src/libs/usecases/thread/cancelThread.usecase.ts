import { IsNotEmpty } from "class-validator";

import { IsObjectId } from "../../../packages/class-validator";
import { BaseUsecase, UserCommand } from "../../core";

import { IThread, ThreadModel, ThreadStatus } from "../../dal/thread";

export namespace CancelThread {
  export class Command extends UserCommand {
    @IsObjectId()
    @IsNotEmpty()
    threadId: string;
  }
  type Response = {
    success: boolean;
  };
  class CancelThreadUsecase extends BaseUsecase {
    async execute(command: Command): Promise<Response> {
      const { threadId } = command;
      await ThreadModel.findOneAndUpdate(
        {
          _id: threadId,
        },
        { $set: { status: ThreadStatus.closed, gameOrderId: undefined } }
      );

      return { success: true };
    }
  }

  export const usecase = new CancelThreadUsecase();
}
