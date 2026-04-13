import 'server-only';

const variablePattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

type PromptVariableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | Record<string, unknown>;

function formatPromptValue(value: PromptVariableValue) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function renderPrompt(template: string, variables: Record<string, PromptVariableValue>): string {
  return template.replace(variablePattern, (_, key: string) => {
    return formatPromptValue(variables[key]);
  });
}
