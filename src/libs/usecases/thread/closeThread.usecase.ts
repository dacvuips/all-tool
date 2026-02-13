import { IsNotEmpty } from "class-validator";

import { IsObjectId } from "../../../packages/class-validator";
import { BaseUsecase, UserCommand } from "../../core";

import { IThread, ThreadModel, ThreadStatus } from "../../dal/thread";

export namespace CloseThread {
  export class Command extends UserCommand {
    @IsObjectId()
    @IsNotEmpty()
    threadId: string;
    @IsNotEmpty()
    status: string;
  }

  type Response = {
    success: boolean;
  };
  class CloseThreadUsecase extends BaseUsecase {
    async execute(command: Command): Promise<Response> {
      const { threadId, status } = command;
      await ThreadModel.findOneAndUpdate(
        {
          _id: threadId,
        },
        { $set: { status } }
      );

      return { success: true };
    }
  }

  export const usecase = new CloseThreadUsecase();
}
