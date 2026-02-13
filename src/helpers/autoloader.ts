import { Autoloader } from "autoloader-ts";
import _ from "lodash";

export async function loadGraphqlSchema() {
  const loader = await Autoloader.dynamicImport();
  await loader.fromGlob(__dirname + "/../**/*.schema.(ts|js)");
  const exports = loader.getResult().exports;
  return exports;
}

export async function loadGraphqlResolver() {
  const loader = await Autoloader.dynamicImport();
  await loader.fromGlob(__dirname + "/../**/*.resolver.(ts|js)");
  const exports = loader.getResult().exports;
  return _.reduce(
    exports,
    (pre, value) => {
      return _.merge(pre, value);
    },
    {} as any
  );
}

export async function loadGraphql() {
  const loader = await Autoloader.dynamicImport();
  await loader.fromGlob(__dirname + "/../**/*.graphql.(ts|js)");
  const exports = loader.getResult().exports;
  return _.reduce(
    exports,
    (pre, value) => {
      if (value.schema) {
        pre.typedefs.push(value.schema);
      }
      if (value.resolvers) {
        pre.resolvers = _.merge(pre.resolvers, value.resolvers);
      }
      return pre;
    },
    { typedefs: [], resolvers: {} } as { typedefs: any[]; resolvers: any }
  );
}

export async function loadMigration() {
  const loader = await Autoloader.dynamicImport();
  await loader.fromGlob(__dirname + "/../**/*.migrate.(ts|js)");
  const exports = loader.getResult().exports;
  return exports;
}

export async function loadModel() {
  const loader = await Autoloader.dynamicImport();
  await loader.fromGlob(__dirname + "/../**/*.model.(ts|js)");
  const exports = loader.getResult().exports;
  return exports;
}
