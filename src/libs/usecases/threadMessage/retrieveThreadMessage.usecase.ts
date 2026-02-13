import { IsNotEmpty } from "class-validator";

import { IsObjectId } from "../../../packages/class-validator";
import { BaseUsecase, UserCommand } from "../../core";

import { CONSTANTS } from "../../../constants/constant.const";
import { ThreadModel } from "../../dal/thread";
import { ThreadMessageModel } from "../../dal/threadMessage";
import { pubsub } from "../../graphql/pub-sub";

export namespace RetrieveThreadMessage {
  export class Command extends UserCommand {
    @IsObjectId()
    @IsNotEmpty()
    threadMessageId: string;
  }
  type Response = {
    success: boolean;
  };
  class RetrieveThreadMessageUsecase extends BaseUsecase {
    async execute(command: Command): Promise<Response> {
      const { threadMessageId } = command;
      const message = await ThreadMessageModel.findOneAndUpdate(
        {
          _id: threadMessageId,
        },
        { $set: { isActive: false } }
      );
      const thread = await ThreadModel.findOne({
        _id: message.threadId,
      });

      pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.THREAD_MESSAGE, {
        event: "message",
        threadId: thread._id,
        data: message,
      });

      return { success: true };
    }
  }

  export const usecase = new RetrieveThreadMessageUsecase();
}
