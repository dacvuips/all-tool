---
to: src/libs/dal/<%= h.inflection.camelize(name, true) %>/index.ts
---
export * from "./<%= h.inflection.camelize(name, true) %>.interface";
export * from "./<%= h.inflection.camelize(name, true) %>.model";
export * from "./<%= h.inflection.camelize(name, true) %>.service";
