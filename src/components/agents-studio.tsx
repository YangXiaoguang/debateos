'use client';

import Link from 'next/link';
import { useState } from 'react';

import { AgentAvatar } from '@/components/ui/agent-avatar';
import { AppShell } from '@/components/app-shell';
import { ModalShell } from '@/components/ui/modal-shell';
import { AGENT_AVATAR_PRESETS, pickNextRandomAgentAvatarUrl, pickRandomAgentAvatarUrl, resolveAgentAvatarUrl, resolveAgentAvatarPreset } from '@/lib/agents/avatar-presets';
import {
  ActionButton,
  EmptyState,
  FieldLabel,
  InlineHint,
  MetricTile,
  SectionTitle,
  SelectInput,
  StatusBadge,
  SurfaceCard,
  TextArea,
  TextInput,
  cx,
} from '@/components/ui/console-kit';
import { requestJson } from '@/lib/client/request-json';
import type { AgentListItem, DashboardSnapshot, ManagedModelView, ModelCredentialStatus } from '@/types/domain';

const AGENT_TEMPLATES = [
  {
    name: '政策鹰派',
    description: '关注风险控制、治理边界与执行确定性。',
    systemPrompt: '你是政策鹰派，偏好明确边界、风险前置和可执行约束。请用结构化方式论证，并主动指出潜在代价。',
    stylePrompt: '锋利、严谨、偏风险控制',
    stanceTags: '风险控制,治理,执行',
  },
  {
    name: '产品实用主义者',
    description: '优先考虑用户价值、上线节奏与资源效率。',
    systemPrompt: '你是产品实用主义者，强调用户价值、资源效率和落地速度。请避免空泛表态，尽量给出折中与推进路径。',
    stylePrompt: '务实、克制、结果导向',
    stanceTags: '用户价值,效率,落地',
  },
  {
    name: '反对派审稿人',
    description: '擅长找漏洞、拆论证和挑战不完整假设。',
    systemPrompt: '你是反对派审稿人，专注寻找逻辑漏洞、缺失证据和被忽略的反例。请保持高标准质疑。',
    stylePrompt: '冷静、尖锐、批判性强',
    stanceTags: '质疑,反例,批判',
  },
];

type AgentDraft = {
  name: string;
  description: string;
  avatarUrl: string;
  modelId: string;
  stylePrompt: string;
  stanceTags: string;
  systemPrompt: string;
};

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; agentId: string }
  | { type: 'view'; agentId: string }
  | null;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function modelStatusLabel(status: ModelCredentialStatus) {
  if (status === 'not_required') return '无需密钥';
  if (status === 'stored') return '已存密钥';
  if (status === 'environment') return '环境变量可用';
  return '缺少密钥';
}

function buildEmptyDraft(defaultModelId: string): AgentDraft {
  return {
    name: '',
    description: '',
    avatarUrl: resolveAgentAvatarUrl(null, 'draft'),
    modelId: defaultModelId,
    stylePrompt: '',
    stanceTags: '理性,结构化',
    systemPrompt: '你是一个善于结构化辩论、强调可执行性的专业 Agent。',
  };
}

function buildDraftFromAgent(agent: AgentListItem, fallbackModelId: string): AgentDraft {
  return {
    name: agent.name,
    description: agent.description ?? '',
    avatarUrl: resolveAgentAvatarUrl(agent.avatarUrl, agent.id),
    modelId: agent.modelId ?? fallbackModelId,
    stylePrompt: agent.stylePrompt ?? '',
    stanceTags: agent.stanceTags.join(','),
    systemPrompt: agent.systemPrompt,
  };
}

function normalizeTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectedModelName(models: ManagedModelView[], modelId: string | null) {
  return models.find((model) => model.id === modelId)?.displayName ?? '未绑定模型';
}

export function AgentsStudio({ initialData }: { initialData: DashboardSnapshot }) {
  const { viewer, models } = initialData;
  const defaultModelId = models.find((model) => model.defaultUseCases.includes('agent'))?.id ?? models[0]?.id ?? '';

  const [agents, setAgents] = useState(initialData.agents);
  const [selectedId, setSelectedId] = useState(initialData.agents[0]?.id ?? '');
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [draft, setDraft] = useState<AgentDraft>(() => buildEmptyDraft(defaultModelId));
  const [pageError, setPageError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedAgent = agents.find((agent) => agent.id === selectedId) ?? null;
  const activeDialogAgent =
    dialogState && dialogState.type !== 'create' ? agents.find((agent) => agent.id === dialogState.agentId) ?? null : null;
  const isEditorOpen = dialogState?.type === 'create' || dialogState?.type === 'edit';
  const isViewOpen = dialogState?.type === 'view';
  const activeAgents = agents.filter((agent) => agent.status === 'active').length;
  const boundAgents = agents.filter((agent) => Boolean(agent.modelId)).length;
  const selectedDraftAvatar = resolveAgentAvatarPreset(draft.avatarUrl, draft.name || 'draft');

  function openCreateDialog() {
    setDraft({
      ...buildEmptyDraft(defaultModelId),
      avatarUrl: pickRandomAgentAvatarUrl(),
    });
    setEditorError(null);
    setEditorNotice(null);
    setDialogState({ type: 'create' });
  }

  function openEditDialog(agent: AgentListItem) {
    setSelectedId(agent.id);
    setDraft(buildDraftFromAgent(agent, defaultModelId));
    setEditorError(null);
    setEditorNotice(null);
    setDialogState({ type: 'edit', agentId: agent.id });
  }

  function openViewDialog(agent: AgentListItem) {
    setSelectedId(agent.id);
    setDialogState({ type: 'view', agentId: agent.id });
  }

  function closeDialog() {
    if (isSaving) return;
    setDialogState(null);
    setEditorError(null);
    setEditorNotice(null);
  }

  function applyTemplate(index: number) {
    const template = AGENT_TEMPLATES[index];
    if (!template) return;

    setDraft((current) => ({
      ...current,
      name: template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      stylePrompt: template.stylePrompt,
      stanceTags: template.stanceTags,
    }));
  }

  async function handleSaveAgent() {
    if (!dialogState || dialogState.type === 'view') {
      return;
    }

    const mode = dialogState.type;
    setIsSaving(true);
    setEditorError(null);
    setEditorNotice(null);
    setPageError(null);

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      avatarUrl: draft.avatarUrl,
      modelId: draft.modelId,
      systemPrompt: draft.systemPrompt.trim(),
      stylePrompt: draft.stylePrompt.trim() || undefined,
      stanceTags: normalizeTags(draft.stanceTags),
    };

    try {
      const saved = await requestJson<AgentListItem>(mode === 'create' ? '/api/v1/agents' : `/api/v1/agents/${dialogState.agentId}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        body: JSON.stringify(payload),
      });

      setAgents((current) => {
        if (mode === 'create') {
          return [saved, ...current];
        }

        return current.map((agent) => (agent.id === saved.id ? saved : agent));
      });
      setSelectedId(saved.id);
      setDraft(buildDraftFromAgent(saved, defaultModelId));
      setDialogState({ type: 'edit', agentId: saved.id });
      setEditorNotice(mode === 'create' ? 'Agent 已创建完成。你可以继续调整，或点击“关闭”退出弹窗。' : 'Agent 已保存。点击“关闭”即可退出弹窗。');
    } catch (requestError) {
      setEditorError(requestError instanceof Error ? requestError.message : '保存 Agent 失败。');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAgent(agent: AgentListItem) {
    const confirmed = window.confirm(`确定删除 Agent “${agent.name}” 吗？未被历史辩论引用的 Agent 才能删除。`);
    if (!confirmed) return;

    setDeletingId(agent.id);
    setPageError(null);

    try {
      await requestJson<{ id: string; deleted: boolean }>(`/api/v1/agents/${agent.id}`, {
        method: 'DELETE',
      });

      const nextSelectedId = selectedId === agent.id ? agents.find((item) => item.id !== agent.id)?.id ?? '' : selectedId;

      setAgents((current) => current.filter((item) => item.id !== agent.id));
      setSelectedId(nextSelectedId);
      setDialogState((current) => {
        if (current && current.type !== 'create' && current.agentId === agent.id) {
          return null;
        }
        return current;
      });
    } catch (requestError) {
      setPageError(requestError instanceof Error ? requestError.message : '删除 Agent 失败。');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell
      viewer={viewer}
      activeNav="agents"
      eyebrow="Agents / Asset Library"
      title="Agent 管理页现在把“查看、编辑、新建”都统一收进当前视口内的弹出界面。"
      description="列表页本体只负责资产浏览和行级操作。查看详情、编辑 Agent、新建 Agent 都会在当前窗口范围内弹出，避免操作区域落到页面下方。"
      actions={
        <>
          <ActionButton variant="primary" onClick={openCreateDialog} disabled={models.length === 0}>
            新建 Agent
          </ActionButton>
          <Link href="/launch" className="ui-action-button ui-action-secondary">
            去发起辩论
          </Link>
          <Link href="/" className="ui-action-button ui-action-ghost">
            返回工作台
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Total Agents" value={agents.length} detail="当前角色资产总数" />
          <MetricTile label="Active" value={activeAgents} detail="当前可直接参战的 Agent" />
          <MetricTile label="Bound Models" value={boundAgents} detail="已绑定单一模型的 Agent" />
          <MetricTile label="Ready Models" value={models.length} detail="可供 Agent 单选绑定的模型池" />
        </div>

        {models.length === 0 ? (
          <SurfaceCard className="rounded-[24px] border-amber-300/30 bg-amber-300/10 px-4 py-4 text-sm text-amber-50">
            当前还没有可用模型。请先到 <Link href="/settings/models" className="underline underline-offset-4">模型管理</Link> 配置至少一个模型，再创建 Agent。
          </SurfaceCard>
        ) : null}

        {pageError ? (
          <SurfaceCard className="rounded-[24px] border-rose-400/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
            {pageError}
          </SurfaceCard>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_340px]">
          <SurfaceCard className="rounded-[30px] px-5 py-5">
            <SectionTitle
              eyebrow="Library"
              title="Agent 列表"
              description="每条资产都提供查看详情、编辑和删除动作。详细信息不再直接占用页面下半部分。"
              actions={<StatusBadge tone="info">{agents.length} agents</StatusBadge>}
            />

            <div className="mt-5 space-y-3">
              {agents.length > 0 ? (
                agents.map((agent) => {
                  const isSelected = selectedId === agent.id;

                  return (
                    <div
                      key={agent.id}
                      className={cx(
                        'rounded-[24px] border px-4 py-4 transition',
                        isSelected ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/8 bg-white/4'
                      )}
                    >
                      <button type="button" onClick={() => setSelectedId(agent.id)} className="w-full text-left">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <AgentAvatar avatarUrl={agent.avatarUrl} seed={agent.id} name={agent.name} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">{agent.name}</div>
                              <div className="mt-2 text-xs leading-6 text-white/46">{agent.description || '未填写角色说明'}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge tone={agent.modelId ? 'info' : 'danger'}>
                              {selectedModelName(models, agent.modelId)}
                            </StatusBadge>
                            <StatusBadge tone={agent.status === 'active' ? 'success' : 'warning'}>{agent.status}</StatusBadge>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {agent.stanceTags.length > 0 ? (
                            agent.stanceTags.map((tag) => <StatusBadge key={tag}>{tag}</StatusBadge>)
                          ) : (
                            <StatusBadge tone="warning">未设置立场标签</StatusBadge>
                          )}
                          <StatusBadge>{formatTimestamp(agent.updatedAt)}</StatusBadge>
                        </div>
                      </button>

                      <div className="mt-4 flex flex-wrap gap-3 border-t border-white/8 pt-4">
                        <ActionButton variant="ghost" onClick={() => openViewDialog(agent)}>
                          查看详情
                        </ActionButton>
                        <ActionButton variant="secondary" onClick={() => openEditDialog(agent)} disabled={models.length === 0}>
                          编辑
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => void handleDeleteAgent(agent)}
                          disabled={deletingId === agent.id}
                        >
                          {deletingId === agent.id ? '删除中...' : '删除'}
                        </ActionButton>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState className="text-left">
                  还没有 Agent。点击右上角“新建 Agent”，先准备至少两个立场明显不同的角色，再进入发起页组装阵容。
                </EmptyState>
              )}
            </div>
          </SurfaceCard>

          <div className="space-y-5">
            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle
                eyebrow="Selection"
                title="当前选中"
                description="右侧只保留轻量摘要。真正的详细信息、编辑和新建都会在弹出窗口内完成。"
              />

              {selectedAgent ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <AgentAvatar avatarUrl={selectedAgent.avatarUrl} seed={selectedAgent.id} name={selectedAgent.name} size="lg" />
                    <div>
                      <div className="text-lg font-semibold text-white">{selectedAgent.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-soft)]">{resolveAgentAvatarPreset(selectedAgent!.avatarUrl, selectedAgent!.id).name}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={selectedAgent.status === 'active' ? 'success' : 'warning'}>{selectedAgent.status}</StatusBadge>
                    <StatusBadge tone={selectedAgent.modelId ? 'info' : 'danger'}>
                      {selectedModelName(models, selectedAgent.modelId)}
                    </StatusBadge>
                  </div>
                  <div className="text-sm leading-7 text-[var(--text-soft)]">
                    {selectedAgent.description || '当前还没有补充角色说明。'}
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-white/62">
                    {selectedAgent.systemPrompt.slice(0, 140)}
                    {selectedAgent.systemPrompt.length > 140 ? '...' : ''}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedAgent.stanceTags.length > 0 ? (
                      selectedAgent.stanceTags.map((tag) => <StatusBadge key={tag}>{tag}</StatusBadge>)
                    ) : (
                      <StatusBadge tone="warning">未设置立场标签</StatusBadge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <ActionButton variant="ghost" onClick={() => openViewDialog(selectedAgent)}>
                      查看详情
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={() => openEditDialog(selectedAgent)} disabled={models.length === 0}>
                      编辑当前 Agent
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <EmptyState className="mt-5 text-left">从左侧选择一个 Agent 后，这里会显示简要摘要，并可打开详情弹窗。</EmptyState>
              )}
            </SurfaceCard>

            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle
                eyebrow="Binding Rule"
                title="模型绑定约束"
                description="每个 Agent 只能绑定一个模型。创建和编辑都必须在弹窗里明确选择。"
              />
              <div className="mt-5 space-y-3">
                {models.map((model) => (
                  <div key={model.id} className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{model.displayName}</div>
                        <div className="mt-1 text-xs text-white/40">{model.provider}</div>
                      </div>
                      <StatusBadge tone={model.credentialStatus === 'missing' ? 'warning' : 'success'}>
                        {modelStatusLabel(model.credentialStatus)}
                      </StatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>

      <ModalShell
        open={Boolean(isEditorOpen)}
        onClose={closeDialog}
        title={dialogState?.type === 'create' ? '新建 Agent' : '编辑 Agent'}
        description="所有创建和编辑都在当前窗口内弹出完成。保存成功后你可以继续检查内容，再点击“关闭”退出。"
        className="max-w-[960px]"
        actions={
          <>
            <ActionButton variant="ghost" onClick={closeDialog} disabled={isSaving}>
              关闭
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => void handleSaveAgent()}
              disabled={isSaving || !draft.name.trim() || !draft.systemPrompt.trim() || !draft.modelId}
            >
              {isSaving ? '保存中...' : dialogState?.type === 'create' ? '创建 Agent' : '保存修改'}
            </ActionButton>
          </>
        }
      >
        <div className="space-y-5">
          {editorNotice ? (
            <SurfaceCard className="rounded-[22px] border-emerald-300/30 bg-emerald-300/10 px-4 py-4 text-sm text-emerald-50">
              {editorNotice}
            </SurfaceCard>
          ) : null}

          {editorError ? (
            <SurfaceCard className="rounded-[22px] border-rose-400/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
              {editorError}
            </SurfaceCard>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {AGENT_TEMPLATES.map((template, index) => (
              <button
                key={template.name}
                type="button"
                onClick={() => applyTemplate(index)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/72 transition hover:bg-white/9"
              >
                套用 {template.name}
              </button>
            ))}
          </div>

          <SurfaceCard className="rounded-[24px] px-4 py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <AgentAvatar
                  avatarUrl={selectedDraftAvatar.imageUrl}
                  seed={draft.name || selectedDraftAvatar.id}
                  name={draft.name || selectedDraftAvatar.name}
                  size="xl"
                />
                <div>
                  <div className="text-sm font-semibold text-white">当前头像</div>
                  <div className="mt-1 text-xs leading-6 text-white/44">{selectedDraftAvatar.name}</div>
                </div>
              </div>
              <ActionButton
                variant="secondary"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    avatarUrl: pickNextRandomAgentAvatarUrl(current.avatarUrl),
                  }))
                }
              >
                随机一个
              </ActionButton>
            </div>

            <div className="mt-5">
              <FieldLabel label="头像选择" hint="可选择小动物、机器人、外星人等卡通头像；默认会随机分配一个。" />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {AGENT_AVATAR_PRESETS.map((preset) => {
                  const active = draft.avatarUrl === preset.imageUrl;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, avatarUrl: preset.imageUrl }))}
                      className={cx(
                        'rounded-[22px] border px-3 py-3 text-left transition',
                        active ? 'border-cyan-300/28 bg-cyan-300/10' : 'border-white/8 bg-white/4 hover:bg-white/6'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <AgentAvatar avatarUrl={preset.imageUrl} seed={preset.id} name={preset.name} size="sm" />
                        <div>
                          <div className="text-sm font-semibold text-white">{preset.name}</div>
                          <div className="mt-1 text-[11px] text-white/38">{preset.id}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </SurfaceCard>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel label="Agent 名称" hint="优先体现立场、人格或专业视角。" />
              <TextInput
                className="mt-3"
                placeholder="例如：政策鹰派"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div>
              <FieldLabel label="绑定模型" hint="必填。每个 Agent 只能绑定 1 个模型，运行时严格使用这里的选择。" />
              <SelectInput
                className="mt-3"
                value={draft.modelId}
                onChange={(event) => setDraft((current) => ({ ...current, modelId: event.target.value }))}
              >
                <option value="" disabled className="bg-slate-950">
                  请选择一个模型
                </option>
                {models.map((model) => (
                  <option key={model.id} value={model.id} className="bg-slate-950">
                    {model.displayName} · {model.provider} · {modelStatusLabel(model.credentialStatus)}
                  </option>
                ))}
              </SelectInput>
            </div>

            <div>
              <FieldLabel label="角色说明" hint="一句话说清背景、关注点与工作方式。" />
              <TextArea
                className="mt-3 min-h-[120px]"
                placeholder="例如：关注治理边界、风控与执行约束"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            <div>
              <FieldLabel label="表达风格" hint="例如：冷静、直接、数据导向。" />
              <TextInput
                className="mt-3"
                placeholder="例如：锋利、克制"
                value={draft.stylePrompt}
                onChange={(event) => setDraft((current) => ({ ...current, stylePrompt: event.target.value }))}
              />

              <FieldLabel className="mt-4" label="立场标签" hint="用英文逗号分隔，方便后续快速筛选。" />
              <TextInput
                className="mt-3"
                placeholder="风险控制,治理,执行"
                value={draft.stanceTags}
                onChange={(event) => setDraft((current) => ({ ...current, stanceTags: event.target.value }))}
              />

              <InlineHint className="mt-3">
                当前模型：{selectedModelName(models, draft.modelId)}。后续辩论发言会固定走这一个模型。
              </InlineHint>
            </div>
          </div>

          <details className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-white">高级配置</summary>
            <div className="mt-4">
              <FieldLabel label="系统提示词" hint="这是角色在所有辩题下的底层行为准则。" />
              <TextArea
                className="mt-3 min-h-[220px]"
                placeholder="系统提示词"
                value={draft.systemPrompt}
                onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
              />
            </div>
          </details>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(isViewOpen && activeDialogAgent)}
        onClose={closeDialog}
        title={activeDialogAgent ? `${activeDialogAgent.name} · 详情` : 'Agent 详情'}
        description="这里提供完整的 Agent 资产信息。查看结束后点击“关闭”即可回到列表。"
        className="max-w-[980px]"
        actions={
          <>
            <ActionButton variant="ghost" onClick={closeDialog}>
              关闭
            </ActionButton>
            {activeDialogAgent ? (
              <ActionButton variant="secondary" onClick={() => openEditDialog(activeDialogAgent)} disabled={models.length === 0}>
                编辑 Agent
              </ActionButton>
            ) : null}
          </>
        }
      >
        {activeDialogAgent ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_300px]">
            <div className="space-y-5">
              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Profile" title="角色画像" description="完整展示角色说明、风格和立场标签。" />
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <AgentAvatar avatarUrl={activeDialogAgent.avatarUrl} seed={activeDialogAgent.id} name={activeDialogAgent.name} size="xl" />
                    <div>
                      <div className="text-2xl font-semibold tracking-[-0.03em] text-white">{activeDialogAgent.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-soft)]">{resolveAgentAvatarPreset(activeDialogAgent!.avatarUrl, activeDialogAgent!.id).name}</div>
                    </div>
                  </div>
                  <div className="text-sm leading-7 text-[var(--text-soft)]">
                    {activeDialogAgent.description || '当前还没有补充角色说明。'}
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/34">Style Prompt</div>
                    <div className="mt-3 text-sm leading-7 text-white/62">{activeDialogAgent.stylePrompt || '未设置表达风格。'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeDialogAgent.stanceTags.length > 0 ? (
                      activeDialogAgent.stanceTags.map((tag) => <StatusBadge key={tag}>{tag}</StatusBadge>)
                    ) : (
                      <StatusBadge tone="warning">未设置立场标签</StatusBadge>
                    )}
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Prompt" title="系统提示词" description="这是该 Agent 在所有辩题里的底层行为规则。" />
                <div className="mt-5 rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 whitespace-pre-wrap text-white/64">
                  {activeDialogAgent.systemPrompt}
                </div>
              </SurfaceCard>
            </div>

            <div className="space-y-5">
              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Binding" title="模型与状态" description="Agent 在辩论中只能使用这里预先绑定的模型。" />
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={activeDialogAgent.status === 'active' ? 'success' : 'warning'}>{activeDialogAgent.status}</StatusBadge>
                    <StatusBadge tone={activeDialogAgent.modelId ? 'info' : 'danger'}>
                      {selectedModelName(models, activeDialogAgent.modelId)}
                    </StatusBadge>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-white/62">
                    每个 Agent 只能绑定一个模型。辩论发起后，系统会严格使用这个预选模型，不会在过程中临时切换。
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Meta" title="时间信息" description="方便快速判断最近的维护时间。" />
                <div className="mt-5 space-y-3 text-sm text-white/64">
                  <div>创建时间：{formatTimestamp(activeDialogAgent.createdAt)}</div>
                  <div>更新时间：{formatTimestamp(activeDialogAgent.updatedAt)}</div>
                </div>
              </SurfaceCard>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </AppShell>
  );
}
