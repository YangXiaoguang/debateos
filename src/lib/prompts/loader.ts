import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

const promptCache = new Map<string, string>();

export async function loadPrompt(relativePath: string): Promise<string> {
  const cached = promptCache.get(relativePath);

  if (cached) {
    return cached;
  }

  const promptsDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.PROMPTS_DIR || 'prompts');
  const filePath = path.join(promptsDir, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const content = source.replace(/^---\n[\s\S]*?\n---\n?/u, '').trim();

  promptCache.set(relativePath, content);
  return content;
}
