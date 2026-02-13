---
to: src/libs/dal/<%= h.inflection.camelize(name, true) %>/<%= h.inflection.camelize(name, true) %>.interface.ts
---
import { TimestampEntity } from "../../core";

export type I<%= h.inflection.camelize(name) %> = TimestampEntity & {
  name?: string;
};