const URL_REGEX = /^https?:\/\/\S+$/i;

export function parseAppPromptContent(content: string): { prompts: string[]; links: string[] } {
  const trimmed = content.trim();
  if (!trimmed) return { prompts: [], links: [] };

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const links: string[] = [];
  const prompts: string[] = [];

  for (const line of lines) {
    if (URL_REGEX.test(line)) {
      links.push(line);
    } else {
      prompts.push(line);
    }
  }

  if (links.length === 0 && prompts.length === 0 && URL_REGEX.test(trimmed)) {
    links.push(trimmed);
  }

  return { prompts, links };
}
