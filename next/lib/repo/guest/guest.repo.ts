import gql from "graphql-tag";
import { GraphRepository } from "../graph.repo";

export class GuestRepository extends GraphRepository {
  async getGuestTryOnLimit(): Promise<number> {
    return this.apollo
      .query({
        query: gql`
          query GetGuestTryOnLimit {
            getGuestTryOnLimit
          }
        `,
        fetchPolicy: "no-cache",
      })
      .then((res) => res.data.getGuestTryOnLimit);
  }
}

export const guestService = new GuestRepository();
