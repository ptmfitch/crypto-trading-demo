import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const extensioned = /\.(?:[cm]?[jt]s|json|node|wasm)$/;

export async function resolve(specifier, context, nextResolve) {
  if (
    context.parentURL &&
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !extensioned.test(specifier)
  ) {
    const candidate = fileURLToPath(new URL(`${specifier}.ts`, context.parentURL));
    if (existsSync(candidate)) {
      return nextResolve(`${specifier}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}
