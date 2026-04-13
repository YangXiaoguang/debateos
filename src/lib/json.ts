export function extractJsonBlock(source: string): string {
  const trimmed = source.trim();
  const withoutCodeFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const objectStart = withoutCodeFence.indexOf('{');
  const objectEnd = withoutCodeFence.lastIndexOf('}');

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return withoutCodeFence.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = withoutCodeFence.indexOf('[');
  const arrayEnd = withoutCodeFence.lastIndexOf(']');

  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return withoutCodeFence.slice(arrayStart, arrayEnd + 1);
  }

  return withoutCodeFence;
}

export function parseJsonValue<T>(source: string): T {
  return JSON.parse(extractJsonBlock(source)) as T;
}

export function stringifyPromptInput(value: unknown) {
  return JSON.stringify(value, null, 2);
}
