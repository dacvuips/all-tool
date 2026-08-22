import { ApolloQueryResult, FetchResult, MutationOptions, QueryOptions } from "@apollo/client/core";
import gql from "graphql-tag";
import { initializeApollo, resetApolloClient } from "../graphql/apollo-client";

export class GraphRepository {
  static instance = null;
  static getInstance() {
    if (GraphRepository.instance == null) {
      GraphRepository.instance = new GraphRepository();
    }

    return GraphRepository.instance;
  }

  get apollo() {
    return initializeApollo();
  }

  gql: Function = gql;

  query({
    query,
    options,
    variablesParams,
  }: {
    query: string[] | string;
    options?: Partial<QueryOptions>;
    variablesParams?: string;
  }) {
    return this.apollo.query<any>({
      query: gql`
        ${this.generateGQL("query", query, variablesParams, options?.variables)}
      `,
      variables: options?.variables,
      fetchPolicy: options?.fetchPolicy,
    });
  }

  subscribe({
    query,
    options,
    variablesParams,
  }: {
    query: string[] | string;
    options?: Partial<QueryOptions>;
    variablesParams?: string;
  }) {
    const rawQuery = `${this.generateGQL(
      "subscription",
      query,
      variablesParams,
      options?.variables
    )}`;
    return this.apollo.subscribe({
      query: gql`
        ${rawQuery}
      `,
      variables: options?.variables,
      fetchPolicy: options?.fetchPolicy,
    });
  }

  watchQuery({
    query,
    options,
    variablesParams,
  }: {
    query: string[] | string;
    options?: Partial<QueryOptions>;
    variablesParams?: string;
  }) {
    return this.apollo.watchQuery<any>({
      query: gql`
        ${this.generateGQL("query", query, variablesParams, options?.variables)}
      `,
      variables: options?.variables,
      fetchPolicy: options?.fetchPolicy,
    });
  }

  async mutate({
    mutation,
    options,
    variablesParams,
    clearStore,
  }: {
    mutation: string[] | string;
    options?: Partial<MutationOptions>;
    variablesParams?: string;
    clearStore?: boolean;
  }) {
    let result = await this.apollo.mutate<any>({
      mutation: gql`
        ${this.generateGQL("mutation", mutation, variablesParams, options?.variables)}
      `,
      variables: options?.variables,
      fetchPolicy: options?.fetchPolicy,
      context: options?.context,
    });

    let clearStoreFlag = false;
    if (clearStore !== undefined) {
      clearStoreFlag = clearStore;
    } else {
      let mutationList = [];
      if (typeof mutation == "string") {
        mutationList.push(mutation.trim());
      } else {
        mutationList = mutation.map((x) => x.trim());
      }
      for (const m of mutationList) {
        if (m.indexOf("create") == 0 || m.indexOf("delete") == 0 || m.indexOf("update") == 0) {
          clearStoreFlag = true;
          break;
        }
      }
    }
    if (clearStoreFlag) {
      await this.clearStore();
    }

    return result;
  }

  generateGQL(
    type: "query" | "mutation" | "subscription",
    list: string[] | string,
    variableParams = null,
    variables = null
  ) {
    let logGql: string[];
    let gql = `${type}${variableParams || ""} {
        `;
    if (typeof list == "string") {
      gql += `g0: ${list}
        `;
      logGql = [list];
    } else {
      for (let i = 0; i < list.length; i++) {
        gql += `\ng${i}: ${list[i]}`;
      }
      logGql = list;
    }
    gql += `
      }`;
    gql = gql.replace(/\s{2,}/g, " ");
    if (type == "mutation") {
      console.debug(
        `${type}: ${logGql
          .map((item) => item.slice(0, item.indexOf(variableParams ? "(" : "{")).trim())
          .join(", ")}`,
        variables ? { gql, variables } : { gql }
      );
    }
    return gql;
  }

  async clearStore() {
    const client = this.apollo;
    client.stop();
    try {
      await client.clearStore();
    } catch {
      // Queries may still be winding down after stop(); safe to ignore on logout/reset.
    }
    resetApolloClient();
  }

  handleError(result: ApolloQueryResult<any> | FetchResult) {
    if ((result as ApolloQueryResult<any>).error) {
      throw Error((result as ApolloQueryResult<any>).error.message);
    }
    if (
      (result as ApolloQueryResult<any>).errors &&
      (result as ApolloQueryResult<any>).errors.length > 0
    ) {
      throw Error((result as ApolloQueryResult<any>).errors[0].message);
    }
  }

  parseFragment(fragment) {
    const fragments = [];
    const lines = fragment.trim().split("\n");
    for (const line of lines) {
      const parts = line.split(":");
      const key = parts[0];
      fragments.push(key);
    }
    return fragments.join(" ").trim();
  }
}

export const GraphService = new GraphRepository();
