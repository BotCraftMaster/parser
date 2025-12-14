import { ParserConfigSchema, type ParserConfig } from "../types";

export async function loadConfig(path: string): Promise<ParserConfig> {
  const file = Bun.file(path);
  const content = await file.text();

  if (path.endsWith(".json")) {
    const data = JSON.parse(content);
    return ParserConfigSchema.parse(data);
  }

  if (path.endsWith(".toml")) {
    const TOML = await import("smol-toml");
    const data = TOML.parse(content);
    return ParserConfigSchema.parse(data.parser || data.avito || data);
  }

  throw new Error("Unsupported config format. Use .json or .toml");
}

export async function saveConfig(
  config: ParserConfig,
  path: string
): Promise<void> {
  if (path.endsWith(".json")) {
    await Bun.write(path, JSON.stringify(config, null, 2));
    return;
  }

  if (path.endsWith(".toml")) {
    const TOML = await import("smol-toml");
    const tomlContent = TOML.stringify({ parser: config });
    await Bun.write(path, tomlContent);
    return;
  }

  throw new Error("Unsupported config format. Use .json or .toml");
}
