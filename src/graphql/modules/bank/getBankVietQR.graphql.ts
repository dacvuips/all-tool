import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { VietQR } from "vietqr";

export default {
  schema: gql`
    extend type Query {
      getBankVietQR: Mixed
    }
  `,
  resolver: {
    Query: {
      getBankVietQR: async (root: any, args: any, context: Context) => {
        let vietQR = new VietQR({
          clientID: "2d3622d3-896c-456c-a9c9-75ed6f9711c5",
          apiKey: "6e15b0b9-1b36-4ba2-bdda-1639a6c797b5",
        });

        // list banks are supported create QR code by Vietqr
        const data = await vietQR
          .getBanks()
          .then((banks: any) => {
            return banks;
          })
          .catch((err: any) => {});

        return data;
      },
    },
  },
};
