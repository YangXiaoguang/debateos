'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useState } from 'react';

import { MANAGED_MODEL_PRESETS } from '@/lib/ai/model-presets';
import { AppShell } from '@/components/app-shell';
import { ActionButton, Eyebrow, InlineHint, SelectInput, StatusBadge, SurfaceCard, TextArea, TextInput } from '@/components/ui/console-kit';
import { requestJson } from '@/lib/client/request-json';
import type {
  AppUserProfile,
  ManagedModelView,
  ModelCredentialStatus,
  ModelTransport,
  ModelUseCase,
} from '@/types/domain';

type ModelDraft = {
  editingId: string;
  provider: string;
  transport: ModelTransport;
  modelName: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  apiKeyEnvName: string;
  notes: string;
  isActive: boolean;
  defaultUseCases: ModelUseCase[];
  clearStoredApiKey: boolean;
};

type ModelTestResult = {
  modelId: string;
  displayName: string;
  provider: string;
  modelName: string;
  transport: ModelTransport;
  credentialStatus: ModelCredentialStatus;
  latencyMs: number;
  preview: string;
};

function defaultDraft(models: ManagedModelView[]): ModelDraft {
  const agentDefault = models.find((model) => model.defaultUseCases.includes('agent'));

  return {
    editingId: '',
    provider: agentDefault?.provider || 'OpenAI',
    transport: (agentDefault?.transport || 'openai') as ModelTransport,
    modelName: '',
    displayName: '',
    baseUrl: agentDefault?.baseUrl || '',
    apiKey: '',
    apiKeyEnvName: agentDefault?.apiKeyEnvName || '',
    notes: '',
    isActive: true,
    defaultUseCases: ['agent'] as ModelUseCase[],
    clearStoredApiKey: false,
  };
}

function credentialMeta(status: ModelCredentialStatus) {
  if (status === 'not_required') {
    return {
      label: '无需密钥',
      className: 'border-white/10 bg-white/7 text-white/72',
    };
  }

  if (status === 'stored') {
    return {
      label: '已保存加密密钥',
      className: 'border-emerald-300/28 bg-emerald-400/10 text-emerald-100',
    };
  }

  if (status === 'environment') {
    return {
      label: '环境变量可用',
      className: 'border-cyan-300/28 bg-cyan-300/10 text-cyan-100',
    };
  }

  return {
    label: '缺少可用密钥',
    className: 'border-amber-300/28 bg-amber-300/10 text-amber-100',
  };
}

function transportLabel(transport: ModelTransport) {
  if (transport === 'openai-compatible') {
    return 'OpenAI-Compatible';
  }

  if (transport === 'openai') {
    return 'OpenAI Responses';
  }

  if (transport === 'anthropic') {
    return 'Anthropic Messages';
  }

  return 'Mock';
}

export function ModelRegistry({
  viewer,
  initialModels,
}: {
  viewer: AppUserProfile;
  initialModels: ManagedModelView[];
}) {
  const router = useRouter();
  const [models, setModels] = useState(initialModels);
  const [draft, setDraft] = useState<ModelDraft>(defaultDraft(initialModels));
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);

  const editingModel = draft.editingId ? models.find((model) => model.id === draft.editingId) ?? null : null;

  function loadModel(model: ManagedModelView) {
    setDraft({
      editingId: model.id,
      provider: model.provider,
      transport: model.transport,
      modelName: model.modelName,
      displayName: model.displayName,
      baseUrl: model.baseUrl || '',
      apiKey: '',
      apiKeyEnvName: model.apiKeyEnvName || '',
      notes: model.notes || '',
      isActive: model.isActive,
      defaultUseCases: model.defaultUseCases,
      clearStoredApiKey: false,
    });
    setTestResult(null);
    setError(null);
  }

  function resetDraft() {
    setDraft(defaultDraft(models));
    setTestResult(null);
    setError(null);
  }

  function applyPreset(presetId: string) {
    const preset = MANAGED_MODEL_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setDraft((current) => ({
      ...current,
      provider: preset.provider,
      transport: preset.transport,
      modelName: preset.transport === 'mock' ? 'mock-debate-v1' : '',
      displayName: preset.label,
      baseUrl: preset.baseUrl || '',
      apiKey: '',
      apiKeyEnvName: preset.apiKeyEnvName || '',
      notes: preset.notes,
      clearStoredApiKey: false,
    }));
    setTestResult(null);
    setError(null);
  }

  function toggleUseCase(useCase: ModelUseCase) {
    setDraft((current) => ({
      ...current,
      defaultUseCases: current.defaultUseCases.includes(useCase)
        ? current.defaultUseCases.filter((item) => item !== useCase)
        : [...current.defaultUseCases, useCase],
    }));
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);

    try {
      const payload = {
        provider: draft.provider,
        transport: draft.transport,
        modelName: draft.modelName,
        displayName: draft.displayName,
        baseUrl: draft.baseUrl || undefined,
        apiKey: draft.apiKey || undefined,
        apiKeyEnvName: draft.apiKeyEnvName || undefined,
        notes: draft.notes || undefined,
        isActive: draft.isActive,
        defaultUseCases: draft.defaultUseCases,
        clearStoredApiKey: draft.clearStoredApiKey || undefined,
      };

      const nextModel = await requestJson<ManagedModelView>(
        draft.editingId ? `/api/v1/models/${draft.editingId}` : '/api/v1/models',
        {
          method: draft.editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      startTransition(() => {
        setModels((current) => {
          const existingIndex = current.findIndex((item) => item.id === nextModel.id);
          if (existingIndex === -1) {
            return [nextModel, ...current];
          }

          const clone = [...current];
          clone[existingIndex] = nextModel;
          return clone;
        });
        setDraft(defaultDraft([nextModel, ...models.filter((item) => item.id !== nextModel.id)]));
        setTestResult(null);
      });

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存模型失败。');
    } finally {
      setPending(false);
    }
  }

  async function handleTestConnection() {
    if (!draft.editingId) return;

    setTesting(true);
    setError(null);

    try {
      const result = await requestJson<ModelTestResult>(`/api/v1/models/${draft.editingId}/test`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setTestResult(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '测试连接失败。');
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppShell
      viewer={viewer}
      activeNav="models"
      eyebrow="Admin / Model Registry"
      title="统一管理真实模型接入、密钥与 Agent 选型"
      description={`当前登录账号为 ${viewer.name || viewer.email}。这里维护的是 DebateOS 的可选模型池，Agent 会严格绑定你选择的模型；如果模型缺少有效密钥，运行时不会再静默回退。`}
      actions={
        <Link href="/" className="ui-action-button ui-action-secondary">
          返回工作台
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <SurfaceCard className="rounded-[30px] p-5">
            <Eyebrow>{draft.editingId ? 'Edit Model' : 'Create Model'}</Eyebrow>
            <h2 className="mt-3 text-xl font-medium">{draft.editingId ? '更新模型配置' : '新增模型配置'}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
              手工 API Key 会使用 `APP_SECRET` 在服务端加密保存。推荐先套用一个预置模板，再补充实际模型 ID、名称和密钥。
            </p>

            {error ? (
              <SurfaceCard className="mt-4 rounded-[18px] border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</SurfaceCard>
            ) : null}

            {testResult ? (
              <SurfaceCard className="mt-4 rounded-[18px] border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
                <div className="font-medium">连接测试成功 · {testResult.latencyMs} ms</div>
                <div className="mt-2 text-emerald-50/82">
                  {testResult.provider} / {testResult.modelName}
                </div>
                <div className="mt-2 text-emerald-50/74">{testResult.preview}</div>
              </SurfaceCard>
            ) : null}

            <div className="mt-5">
              <Eyebrow className="text-white/48">Presets</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-2">
                {MANAGED_MODEL_PRESETS.map((preset) => (
                  <ActionButton
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    variant="ghost"
                    className="rounded-full"
                    title={preset.description}
                  >
                    {preset.label}
                  </ActionButton>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <TextInput
                placeholder="Provider 名称，例如 OpenAI / Anthropic / Qwen"
                value={draft.provider}
                onChange={(event) => setDraft((current) => ({ ...current, provider: event.target.value }))}
              />
              <SelectInput
                value={draft.transport}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    transport: event.target.value as ModelTransport,
                    baseUrl: event.target.value === 'mock' ? '' : current.baseUrl,
                  }))
                }
              >
                <option value="openai">OpenAI Responses</option>
                <option value="openai-compatible">OpenAI-Compatible Chat</option>
                <option value="anthropic">Anthropic Messages</option>
                <option value="mock">Mock</option>
              </SelectInput>
              <TextInput
                placeholder="模型 ID，例如 claude / gpt / qwen 的实际可用模型名"
                value={draft.modelName}
                onChange={(event) => setDraft((current) => ({ ...current, modelName: event.target.value }))}
              />
              <TextInput
                placeholder="显示名称，例如 Claude Judge / Qwen Fast / GPT Core"
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              />
              <TextInput
                placeholder="Base URL，可留空使用官方默认地址；兼容 OpenAI 协议时必须填写"
                value={draft.baseUrl}
                onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
              />
              <TextInput
                type="password"
                placeholder={editingModel?.hasStoredApiKey ? '留空则保留已存密钥，填写则覆盖' : '直接存储新的 API Key'}
                value={draft.apiKey}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    apiKey: event.target.value,
                    clearStoredApiKey: event.target.value ? false : current.clearStoredApiKey,
                  }))
                }
              />
              <TextInput
                placeholder="或填写环境变量名，例如 OPENAI_API_KEY / ANTHROPIC_API_KEY"
                value={draft.apiKeyEnvName}
                onChange={(event) => setDraft((current) => ({ ...current, apiKeyEnvName: event.target.value }))}
              />
              <TextArea
                placeholder="备注：适用场景、延迟成本、上下文窗口、路由说明等"
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            <SurfaceCard tone="strong" className="mt-5 rounded-[24px] px-4 py-4 text-sm text-white/65">
              <Eyebrow className="text-white/48">Credential Status</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge
                  className={credentialMeta(editingModel?.credentialStatus || (draft.transport === 'mock' ? 'not_required' : 'missing')).className}
                >
                  {credentialMeta(editingModel?.credentialStatus || (draft.transport === 'mock' ? 'not_required' : 'missing')).label}
                </StatusBadge>
                {editingModel?.apiKeyEnvName ? (
                  <StatusBadge>Env: {editingModel.apiKeyEnvName}</StatusBadge>
                ) : null}
                {editingModel?.hasStoredApiKey ? (
                  <StatusBadge>已存在一份加密保存的手工密钥</StatusBadge>
                ) : null}
              </div>
              {draft.editingId && editingModel?.hasStoredApiKey ? (
                <ActionButton
                  type="button"
                  variant="ghost"
                  className={`mt-4 rounded-full ${
                    draft.clearStoredApiKey
                      ? 'border-amber-300/28 bg-amber-300/10 text-amber-100'
                      : ''
                  }`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      clearStoredApiKey: !current.clearStoredApiKey,
                      apiKey: '',
                    }))
                  }
                >
                  {draft.clearStoredApiKey ? '保存时清除已存密钥' : '切换为清除已存密钥'}
                </ActionButton>
              ) : null}
              <InlineHint className="mt-4">推荐优先用环境变量托管长期密钥；手工保存更适合临时联调或单模型测试。</InlineHint>
            </SurfaceCard>

            <div className="mt-5 flex flex-wrap gap-3">
              {(['agent', 'judge'] as ModelUseCase[]).map((useCase) => (
                <ActionButton
                  key={useCase}
                  variant="ghost"
                  className={`rounded-full ${
                    draft.defaultUseCases.includes(useCase)
                      ? 'border-cyan-300/40 bg-cyan-300/12 text-cyan-100'
                      : ''
                  }`}
                  onClick={() => toggleUseCase(useCase)}
                  type="button"
                >
                  默认用于 {useCase}
                </ActionButton>
              ))}
              <ActionButton
                variant="ghost"
                className={`rounded-full ${
                  draft.isActive ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/60'
                }`}
                onClick={() => setDraft((current) => ({ ...current, isActive: !current.isActive }))}
                type="button"
              >
                {draft.isActive ? '当前启用' : '当前停用'}
              </ActionButton>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <ActionButton variant="primary" onClick={handleSubmit} disabled={pending}>
                {pending ? '保存中...' : draft.editingId ? '保存修改' : '创建模型'}
              </ActionButton>
              <ActionButton variant="secondary" onClick={resetDraft}>
                新建草稿
              </ActionButton>
              {draft.editingId ? (
                <ActionButton variant="secondary" className="border-emerald-300/20 bg-emerald-400/10 text-emerald-100" onClick={() => void handleTestConnection()} disabled={testing}>
                  {testing ? '测试中...' : '测试连接'}
                </ActionButton>
              ) : null}
            </div>
          </SurfaceCard>

          <SurfaceCard className="rounded-[30px] p-5">
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow className="text-white/48">Available Models</Eyebrow>
                <h2 className="mt-3 text-xl font-medium">当前模型池</h2>
              </div>
              <StatusBadge>{models.length} models</StatusBadge>
            </div>

            <div className="mt-5 grid gap-4">
              {models.map((model) => {
                const credential = credentialMeta(model.credentialStatus);

                return (
                  <button
                    key={model.id}
                    onClick={() => loadModel(model)}
                    className="ui-surface-card ui-surface-card-interactive rounded-[26px] p-5 text-left"
                    type="button"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-medium text-white">{model.displayName}</div>
                      <StatusBadge tone="info">
                        {transportLabel(model.transport)}
                      </StatusBadge>
                      <StatusBadge className={model.isActive ? 'bg-emerald-400/12 text-emerald-100' : 'bg-white/6 text-white/48'}>
                        {model.isActive ? 'active' : 'inactive'}
                      </StatusBadge>
                      <StatusBadge className={credential.className}>{credential.label}</StatusBadge>
                    </div>
                    <div className="mt-3 text-sm text-white/58">
                      {model.provider} · {model.modelName}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/46">
                      <span>Base URL: {model.baseUrl || '官方默认'}</span>
                      <span>Env: {model.apiKeyEnvName || '未指定'}</span>
                      <span>Stored Key: {model.hasStoredApiKey ? 'yes' : 'no'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {model.defaultUseCases.map((useCase) => (
                        <span key={useCase} className="rounded-full border border-cyan-300/18 bg-cyan-300/8 px-3 py-1 text-[11px] text-cyan-100/92">
                          default {useCase}
                        </span>
                      ))}
                      {model.defaultUseCases.length === 0 ? (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/45">仅供手动选择</span>
                      ) : null}
                    </div>
                    {model.notes ? <div className="mt-4 text-sm leading-7 text-white/60">{model.notes}</div> : null}
                  </button>
                );
              })}
            </div>
          </SurfaceCard>
      </div>
    </AppShell>
  );
}
