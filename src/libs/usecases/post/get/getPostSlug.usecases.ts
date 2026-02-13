import { IsNotEmpty, IsString } from "class-validator";

import { t } from "../../../../helpers/functions/string";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { IPost, PostModel } from "../../../dal/post";

export namespace GetPostSlug {
  export class Command extends BaseCommand {
    @IsNotEmpty()
    @IsString()
    slug: string;
  }

  type Response = {
    post: IPost;
  };

  class GetPostSlugUseCase extends BaseUsecase {
    async execute(command: Command): Promise<Response> {
      const { slug } = command;
      const post = await PostModel.findOne({ slug }).orFail(
        new ForbiddenError(t("Bài viết không tồn tại"))
      );
      return { post };
    }
  }

  export const usecase = new GetPostSlugUseCase();
}
