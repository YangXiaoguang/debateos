import 'server-only';

import type { ManagedModelView, ModelCredentialStatus, ModelTransport, ModelUseCase } from '@/types/domain';
import type { SystemModel } from '@/lib/db/schema';
import { createConfiguredLlmProvider, createLlmProvider } from '@/lib/ai/provider';
import { invariant } from '@/lib/http/route';
import { createSystemModel, getSystemModelById, listSystemModels, updateSystemModel } from '@/server/repositories/model.repository';
import { requireAdminUser } from '@/server/auth/session.service';
import { decryptSecret, encryptSecret } from '@/server/security/crypto';

type StoredModelConfig = {
  transport?: ModelTransport;
  baseUrl?: string;
  apiKeyCiphertext?: string;
  apiKeyEnvName?: string;
  defaultUseCases?: ModelUseCase[];
  notes?: string;
};

export type ResolvedModelConnection = {
  id: string;
  provider: string;
  transport: ModelTransport;
  modelName: string;
  displayName: string;
  baseUrl?: string;
  apiKey?: string;
  credentialStatus: ModelCredentialStatus;
  defaultUseCases: ModelUseCase[];
  isActive: boolean;
};

function parseConfig(value: Record<string, unknown> | null | undefined): StoredModelConfig {
  const config = (value ?? {}) as StoredModelConfig;
  const transport = config.transport;

  return {
    transport:
      transport === 'mock' || transport === 'openai' || transport === 'openai-compatible' || transport === 'anthropic'
        ? transport
        : 'openai',
    baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : undefined,
    apiKeyCiphertext: typeof config.apiKeyCiphertext === 'string' ? config.apiKeyCiphertext : undefined,
    apiKeyEnvName: typeof config.apiKeyEnvName === 'string' ? config.apiKeyEnvName : undefined,
    defaultUseCases: Array.isArray(config.defaultUseCases)
      ? config.defaultUseCases.filter((item): item is ModelUseCase => item === 'agent' || item === 'judge')
      : [],
    notes: typeof config.notes === 'string' ? config.notes : undefined,
  };
}

function resolveCredentialStatus(config: StoredModelConfig): ModelCredentialStatus {
  if (config.transport === 'mock') {
    return 'not_required';
  }

  if (config.apiKeyCiphertext) {
    return 'stored';
  }

  if (config.apiKeyEnvName && process.env[config.apiKeyEnvName]) {
    return 'environment';
  }

  return 'missing';
}

function toModelView(model: SystemModel): ManagedModelView {
  const config = parseConfig(model.config as Record<string, unknown> | null | undefined);

  return {
    id: model.id,
    provider: model.provider,
    transport: config.transport ?? 'openai',
    modelName: model.modelName,
    displayName: model.displayName,
    baseUrl: config.baseUrl ?? null,
    apiKeyEnvName: config.apiKeyEnvName ?? null,
    hasStoredApiKey: Boolean(config.apiKeyCiphertext),
    credentialStatus: resolveCredentialStatus(config),
    isActive: model.isActive,
    defaultUseCases: config.defaultUseCases ?? [],
    notes: config.notes ?? null,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}

function buildConfig(input: {
  transport: ModelTransport;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnvName?: string;
  defaultUseCases?: ModelUseCase[];
  notes?: string;
  clearStoredApiKey?: boolean;
}, existing?: SystemModel) {
  const previous = parseConfig(existing?.config as Record<string, unknown> | null | undefined);

  return {
    transport: input.transport,
    baseUrl: input.baseUrl?.trim() || undefined,
    apiKeyCiphertext: input.apiKey ? encryptSecret(input.apiKey.trim()) : input.clearStoredApiKey ? undefined : previous.apiKeyCiphertext,
    apiKeyEnvName: input.apiKeyEnvName?.trim() || undefined,
    defaultUseCases: input.defaultUseCases ?? [],
    notes: input.notes?.trim() || undefined,
  } satisfies StoredModelConfig;
}

function validateManagedModelInput(input: {
  transport: ModelTransport;
  baseUrl?: string;
}) {
  if (input.transport === 'openai-compatible') {
    invariant(Boolean(input.baseUrl?.trim()), 'MODEL_BASE_URL_REQUIRED', 'OpenAI-compatible models require a Base URL.', 400);
  }
}

async function ensureSeedModels() {
  const existing = await listSystemModels();
  if (existing.length > 0) {
    return existing;
  }

  const seeded = [
    await createSystemModel({
      provider: 'System',
      modelName: 'mock-debate-v1',
      displayName: 'Mock Debate Model',
      isActive: true,
      config: {
        transport: 'mock',
        defaultUseCases: ['agent'],
        notes: '本地无 API Key 时的默认演示模型。',
      },
    }),
    await createSystemModel({
      provider: 'OpenAI',
      modelName: process.env.DEFAULT_MODEL || 'gpt-5.4-mini',
      displayName: 'OpenAI Default',
      isActive: true,
      config: {
        transport: 'openai',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKeyEnvName: 'OPENAI_API_KEY',
        defaultUseCases: ['judge'],
        notes: '读取 OPENAI_API_KEY 作为默认真实模型。',
      },
    }),
  ];

  return seeded;
}

export async function listManagedModelsService(options?: { onlyActive?: boolean }) {
  await ensureSeedModels();
  const rows = await listSystemModels(options);
  return rows.map(toModelView);
}

export async function createManagedModelService(input: {
  provider: string;
  transport: ModelTransport;
  modelName: string;
  displayName: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnvName?: string;
  defaultUseCases?: ModelUseCase[];
  notes?: string;
  isActive?: boolean;
}) {
  await requireAdminUser();
  validateManagedModelInput(input);

  const row = await createSystemModel({
    provider: input.provider.trim(),
    modelName: input.modelName.trim(),
    displayName: input.displayName.trim(),
    isActive: input.isActive ?? true,
    config: buildConfig(input) as Record<string, unknown>,
  });

  return toModelView(row);
}

export async function updateManagedModelService(id: string, input: {
  provider?: string;
  transport: ModelTransport;
  modelName: string;
  displayName: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnvName?: string;
  defaultUseCases?: ModelUseCase[];
  notes?: string;
  isActive?: boolean;
  clearStoredApiKey?: boolean;
}) {
  await requireAdminUser();

  const existing = await getSystemModelById(id);
  invariant(existing, 'MODEL_NOT_FOUND', 'Model not found.', 404);
  validateManagedModelInput(input);

  const row = await updateSystemModel(id, {
    provider: input.provider?.trim() || existing.provider,
    modelName: input.modelName.trim(),
    displayName: input.displayName.trim(),
    isActive: input.isActive ?? existing.isActive,
    config: buildConfig(input, existing) as Record<string, unknown>,
    updatedAt: new Date(),
  });

  invariant(row, 'MODEL_NOT_FOUND', 'Model not found.', 404);
  return toModelView(row);
}

function resolveApiKey(config: StoredModelConfig) {
  if (config.apiKeyCiphertext) {
    return decryptSecret(config.apiKeyCiphertext);
  }

  if (config.apiKeyEnvName) {
    return process.env[config.apiKeyEnvName];
  }

  return undefined;
}

function buildResolvedModelConnection(model: SystemModel) {
  const config = parseConfig(model.config as Record<string, unknown> | null | undefined);

  return {
    id: model.id,
    provider: model.provider,
    transport: config.transport ?? 'openai',
    modelName: model.modelName,
    displayName: model.displayName,
    baseUrl: config.baseUrl,
    apiKey: resolveApiKey(config),
    credentialStatus: resolveCredentialStatus(config),
    defaultUseCases: config.defaultUseCases ?? [],
    isActive: model.isActive,
  } satisfies ResolvedModelConnection;
}

export async function resolveManagedModelConnection(options: {
  modelId?: string | null;
  useCase?: ModelUseCase;
  strictSelection?: boolean;
  allowInactive?: boolean;
}) {
  await ensureSeedModels();
  if (options.modelId) {
    const direct = await getSystemModelById(options.modelId);
    invariant(direct || !options.strictSelection, 'MODEL_NOT_FOUND', 'Selected model was not found.', 404);

    if (direct) {
      invariant(options.allowInactive || direct.isActive, 'MODEL_INACTIVE', `Selected model "${direct.displayName}" is inactive.`, 400);
      return buildResolvedModelConnection(direct);
    }
  }

  const rows = await listSystemModels({ onlyActive: true });
  const fallback =
    rows.find((row) => (parseConfig(row.config as Record<string, unknown> | null | undefined).defaultUseCases ?? []).includes(options.useCase ?? 'agent')) ||
    rows[0];
  const selected = fallback ?? null;

  if (!selected) {
    return null;
  }

  return buildResolvedModelConnection(selected);
}

export async function resolveManagedLlmProvider(options: {
  modelId?: string | null;
  useCase?: ModelUseCase;
  strictSelection?: boolean;
  allowInactive?: boolean;
}) {
  const model = await resolveManagedModelConnection(options);

  if (!model) {
    return createLlmProvider();
  }

  if (model.transport === 'mock') {
    return createConfiguredLlmProvider({
      transport: 'mock',
      model: model.modelName,
      provider: model.provider,
    });
  }

  if (!model.apiKey) {
    if (options.strictSelection && options.modelId) {
      throw new Error(`Model "${model.displayName}" is missing an API key. Configure a stored key or a working environment variable first.`);
    }

    if (options.useCase === 'judge' || options.useCase === 'agent') {
      return createLlmProvider();
    }
  }

  return createConfiguredLlmProvider({
    transport: model.transport,
    apiKey: model.apiKey,
    model: model.modelName,
    baseUrl: model.baseUrl,
    provider: model.provider,
  });
}

export async function testManagedModelConnectionService(modelId: string) {
  await requireAdminUser();
  const model = await resolveManagedModelConnection({
    modelId,
    strictSelection: true,
    allowInactive: true,
  });
  invariant(model, 'MODEL_NOT_FOUND', 'Model not found.', 404);
  invariant(
    model.transport === 'mock' || Boolean(model.apiKey),
    'MODEL_CREDENTIALS_MISSING',
    `Model "${model.displayName}" is missing an API key. Please save a manual key or provide a live environment variable.`,
    400
  );

  const provider = createConfiguredLlmProvider({
    transport: model.transport,
    apiKey: model.apiKey,
    model: model.modelName,
    baseUrl: model.baseUrl,
    provider: model.provider,
  });

  const startedAt = Date.now();
  const result = await provider.generate([
    {
      role: 'system',
      content: 'You are a connectivity probe. Reply in one short sentence and confirm the model is reachable.',
    },
    {
      role: 'user',
      content: `Please confirm the connection for provider "${model.provider}" and model "${model.modelName}".`,
    },
  ]);

  return {
    modelId: model.id,
    displayName: model.displayName,
    provider: model.provider,
    modelName: model.modelName,
    transport: model.transport,
    credentialStatus: model.credentialStatus,
    latencyMs: Date.now() - startedAt,
    preview: result.text.slice(0, 240),
  };
}
