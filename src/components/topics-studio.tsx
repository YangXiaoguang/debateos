'use client';

import Link from 'next/link';
import { startTransition, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { ModalShell } from '@/components/ui/modal-shell';
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
import type { DashboardSnapshot, TopicAttachmentView, TopicListItem } from '@/types/domain';

const TOPIC_TEMPLATES = [
  {
    title: '是否应在 90 天内上线 AI 辩论工作台公开版？',
    description: '围绕业务价值、实施风险、团队带宽与品牌影响，讨论是否应该按 90 天窗口推进公开版上线。',
  },
  {
    title: '企业知识库问答是否应该优先使用多 Agent 评审流程？',
    description: '讨论多 Agent 评审是否真的提升质量，还是会引入额外成本与延迟。',
  },
  {
    title: '在有限算力预算下，Judge 是否必须使用更强模型？',
    description: '平衡成本、裁决稳定性和整体体验，判断 Judge 是否一定要绑定强模型。',
  },
];

type TopicDraft = {
  title: string;
  description: string;
  extraContext: string;
  outputRequirements: string;
  maxRounds: string;
  winnerRule: string;
  mode: string;
};

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; topicId: string }
  | { type: 'view'; topicId: string }
  | null;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function extractionTone(status: TopicAttachmentView['extractionStatus']) {
  if (status === 'ready') return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  if (status === 'failed') return 'danger' as const;
  return 'neutral' as const;
}

function buildEmptyDraft(): TopicDraft {
  return {
    title: '',
    description: '',
    extraContext: '',
    outputRequirements: '请给出明确胜者、关键论点和可执行建议。',
    maxRounds: '4',
    winnerRule: 'hybrid',
    mode: 'hybrid',
  };
}

function buildDraftFromTopic(topic: TopicListItem): TopicDraft {
  return {
    title: topic.title,
    description: topic.description,
    extraContext: topic.extraContext ?? '',
    outputRequirements: topic.outputRequirements ?? '',
    maxRounds: String(topic.maxRounds),
    winnerRule: topic.winnerRule,
    mode: topic.mode,
  };
}

function mergeAttachments(existing: TopicAttachmentView[], incoming: TopicAttachmentView[]) {
  const seen = new Set<string>();

  return [...existing, ...incoming].filter((attachment) => {
    if (seen.has(attachment.id)) {
      return false;
    }
    seen.add(attachment.id);
    return true;
  });
}

export function TopicsStudio({ initialData }: { initialData: DashboardSnapshot }) {
  const { viewer } = initialData;
  const [topics, setTopics] = useState(initialData.topics);
  const [selectedId, setSelectedId] = useState(initialData.topics[0]?.id ?? '');
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [draft, setDraft] = useState<TopicDraft>(() => buildEmptyDraft());
  const [topicFiles, setTopicFiles] = useState<File[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedTopic = topics.find((topic) => topic.id === selectedId) ?? null;
  const activeDialogTopic =
    dialogState && dialogState.type !== 'create' ? topics.find((topic) => topic.id === dialogState.topicId) ?? null : null;
  const isEditorOpen = dialogState?.type === 'create' || dialogState?.type === 'edit';
  const isViewOpen = dialogState?.type === 'view';
  const readyTopics = topics.filter((topic) => topic.status === 'ready').length;
  const totalAttachments = topics.reduce((count, topic) => count + topic.attachments.length, 0);
  const enrichedTopics = topics.filter((topic) => topic.attachments.length > 0).length;

  function openCreateDialog() {
    setDraft(buildEmptyDraft());
    setTopicFiles([]);
    setEditorError(null);
    setEditorNotice(null);
    setDialogState({ type: 'create' });
  }

  function openEditDialog(topic: TopicListItem) {
    setSelectedId(topic.id);
    setDraft(buildDraftFromTopic(topic));
    setTopicFiles([]);
    setEditorError(null);
    setEditorNotice(null);
    setDialogState({ type: 'edit', topicId: topic.id });
  }

  function openViewDialog(topic: TopicListItem) {
    setSelectedId(topic.id);
    setDialogState({ type: 'view', topicId: topic.id });
  }

  function closeDialog() {
    if (isSaving) return;
    setDialogState(null);
    setTopicFiles([]);
    setEditorError(null);
    setEditorNotice(null);
  }

  function applyTemplate(index: number) {
    const template = TOPIC_TEMPLATES[index];
    if (!template) return;

    setDraft((current) => ({
      ...current,
      title: template.title,
      description: template.description,
    }));
  }

  async function uploadPendingFiles(topicId: string) {
    if (topicFiles.length === 0) {
      return [];
    }

    const formData = new FormData();
    topicFiles.forEach((file) => formData.append('files', file));

    const response = await fetch(`/api/v1/topics/${topicId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    const payload = (await response.json()) as {
      success: boolean;
      data: TopicAttachmentView[];
      error?: { message?: string };
    };

    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message || '附件上传失败。');
    }

    return payload.data;
  }

  async function handleSaveTopic() {
    if (!dialogState || dialogState.type === 'view') {
      return;
    }

    const mode = dialogState.type;
    setIsSaving(true);
    setPageError(null);
    setEditorError(null);
    setEditorNotice(null);

    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      extraContext: draft.extraContext.trim() || undefined,
      outputRequirements: draft.outputRequirements.trim() || undefined,
      maxRounds: Number(draft.maxRounds || 4),
      mode: draft.mode as 'hybrid' | 'knockout' | 'score' | 'synthesis',
      winnerRule: draft.winnerRule as 'hybrid' | 'last_active' | 'judge_score' | 'user_vote',
    };

    try {
      const saved = await requestJson<TopicListItem>(
        mode === 'create' ? '/api/v1/topics' : `/api/v1/topics/${dialogState.topicId}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      const uploadedAttachments = await uploadPendingFiles(saved.id);
      const completedTopic =
        uploadedAttachments.length > 0
          ? {
              ...saved,
              attachments: mergeAttachments(saved.attachments, uploadedAttachments),
            }
          : saved;

      startTransition(() => {
        setTopics((current) => {
          if (mode === 'create') {
            return [completedTopic, ...current];
          }

          return current.map((topic) => (topic.id === completedTopic.id ? completedTopic : topic));
        });
        setSelectedId(completedTopic.id);
        setDraft(buildDraftFromTopic(completedTopic));
        setTopicFiles([]);
        setDialogState({ type: 'edit', topicId: completedTopic.id });
        setEditorNotice(
          mode === 'create'
            ? 'Topic 已创建完成。你可以继续补充内容或附件，再点击“关闭”退出弹窗。'
            : 'Topic 已保存。点击“关闭”即可退出弹窗。'
        );
      });
    } catch (requestError) {
      setEditorError(requestError instanceof Error ? requestError.message : '保存 Topic 失败。');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTopic(topic: TopicListItem) {
    const confirmed = window.confirm(`确定删除 Topic “${topic.title}” 吗？已经被历史辩论引用的 Topic 当前不能删除。`);
    if (!confirmed) return;

    setDeletingId(topic.id);
    setPageError(null);

    try {
      await requestJson<{ id: string; deleted: boolean }>(`/api/v1/topics/${topic.id}`, {
        method: 'DELETE',
      });

      const nextSelectedId = selectedId === topic.id ? topics.find((item) => item.id !== topic.id)?.id ?? '' : selectedId;

      setTopics((current) => current.filter((item) => item.id !== topic.id));
      setSelectedId(nextSelectedId);
      setDialogState((current) => {
        if (current && current.type !== 'create' && current.topicId === topic.id) {
          return null;
        }
        return current;
      });
    } catch (requestError) {
      setPageError(requestError instanceof Error ? requestError.message : '删除 Topic 失败。');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell
      viewer={viewer}
      activeNav="topics"
      eyebrow="Topics / Context Library"
      title="Topic 管理页现在和 Agents 一样，列表、详情、编辑、新建都按统一的管理模式组织。"
      description="页面主体只保留 Topic 列表和轻量摘要。查看详情、编辑 Topic、新建 Topic 都在当前视口内的弹窗里完成，附件上传也保留在弹窗流程中。"
      actions={
        <>
          <ActionButton variant="primary" onClick={openCreateDialog}>
            新建 Topic
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
          <MetricTile label="Total Topics" value={topics.length} detail="当前 Topic 资产总数" />
          <MetricTile label="Ready" value={readyTopics} detail="可直接发起的辩题" />
          <MetricTile label="Attachments" value={totalAttachments} detail="累计附件数量" />
          <MetricTile label="Enriched" value={enrichedTopics} detail="已附加上下文材料的 Topic" />
        </div>

        {pageError ? (
          <SurfaceCard className="rounded-[24px] border-rose-400/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
            {pageError}
          </SurfaceCard>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_340px]">
          <SurfaceCard className="rounded-[30px] px-5 py-5">
            <SectionTitle
              eyebrow="Library"
              title="Topic 列表"
              description="列表页只负责浏览和操作资产。完整的内容查看、编辑和新建都在弹窗里完成。"
              actions={<StatusBadge tone="info">{topics.length} topics</StatusBadge>}
            />

            <div className="mt-5 space-y-3">
              {topics.length > 0 ? (
                topics.map((topic) => {
                  const isSelected = selectedId === topic.id;

                  return (
                    <div
                      key={topic.id}
                      className={cx(
                        'rounded-[24px] border px-4 py-4 transition',
                        isSelected ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/8 bg-white/4'
                      )}
                    >
                      <button type="button" onClick={() => setSelectedId(topic.id)} className="w-full text-left">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-sm font-semibold text-white">{topic.title}</div>
                            <div className="mt-2 text-xs leading-6 text-white/46">{topic.description.slice(0, 120)}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge tone={topic.status === 'ready' ? 'success' : 'warning'}>{topic.status}</StatusBadge>
                            <StatusBadge>{topic.winnerRule}</StatusBadge>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <StatusBadge>{topic.maxRounds} rounds</StatusBadge>
                          <StatusBadge>{topic.attachments.length} attachments</StatusBadge>
                          <StatusBadge>{formatTimestamp(topic.updatedAt)}</StatusBadge>
                        </div>
                      </button>

                      <div className="mt-4 flex flex-wrap gap-3 border-t border-white/8 pt-4">
                        <ActionButton variant="ghost" onClick={() => openViewDialog(topic)}>
                          查看详情
                        </ActionButton>
                        <ActionButton variant="secondary" onClick={() => openEditDialog(topic)}>
                          编辑
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => void handleDeleteTopic(topic)}
                          disabled={deletingId === topic.id}
                        >
                          {deletingId === topic.id ? '删除中...' : '删除'}
                        </ActionButton>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState className="text-left">
                  还没有 Topic。点击右上角“新建 Topic”，先把议题、附件与胜负规则沉淀成资产，再进入发起页组装辩论。
                </EmptyState>
              )}
            </div>
          </SurfaceCard>

          <div className="space-y-5">
            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle
                eyebrow="Selection"
                title="当前选中"
                description="右侧只保留轻量摘要。完整详情和编辑都放进弹窗，不再把操作区域压到页面下方。"
              />

              {selectedTopic ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={selectedTopic.status === 'ready' ? 'success' : 'warning'}>{selectedTopic.status}</StatusBadge>
                    <StatusBadge>{selectedTopic.mode}</StatusBadge>
                    <StatusBadge>{selectedTopic.winnerRule}</StatusBadge>
                  </div>

                  <div className="text-lg font-semibold text-white">{selectedTopic.title}</div>
                  <div className="text-sm leading-7 text-[var(--text-soft)]">{selectedTopic.description}</div>

                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-white/62">
                    {selectedTopic.outputRequirements || '当前还没有补充输出要求。'}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge>{selectedTopic.maxRounds} rounds</StatusBadge>
                    <StatusBadge>{selectedTopic.attachments.length} attachments</StatusBadge>
                    <StatusBadge>{formatTimestamp(selectedTopic.updatedAt)}</StatusBadge>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <ActionButton variant="ghost" onClick={() => openViewDialog(selectedTopic)}>
                      查看详情
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={() => openEditDialog(selectedTopic)}>
                      编辑当前 Topic
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <EmptyState className="mt-5 text-left">从左侧选择一个 Topic 后，这里会显示简要摘要，并可打开详情弹窗。</EmptyState>
              )}
            </SurfaceCard>

            <SurfaceCard className="rounded-[30px] px-5 py-5">
              <SectionTitle
                eyebrow="Attachment Parsing"
                title="附件与解析概览"
                description="帮助快速判断当前 Topic 的上下文完整度和解析质量。"
              />

              {selectedTopic ? (
                <div className="mt-5 space-y-3">
                  {selectedTopic.attachments.length > 0 ? (
                    selectedTopic.attachments.slice(0, 4).map((attachment) => (
                      <div key={attachment.id} className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{attachment.fileName}</div>
                            <div className="mt-1 text-xs leading-6 text-white/42">
                              {attachment.extractionSummary || '等待附件解析摘要'}
                            </div>
                          </div>
                          <StatusBadge tone={extractionTone(attachment.extractionStatus)}>{attachment.extractionMethod}</StatusBadge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState className="text-left">这个 Topic 还没有附件，上下文目前主要来自手工描述。</EmptyState>
                  )}
                </div>
              ) : (
                <EmptyState className="mt-5 text-left">选择一个 Topic 后，这里会显示附件解析概览。</EmptyState>
              )}
            </SurfaceCard>
          </div>
        </div>
      </div>

      <ModalShell
        open={Boolean(isEditorOpen)}
        onClose={closeDialog}
        title={dialogState?.type === 'create' ? '新建 Topic' : '编辑 Topic'}
        description="Topic 的创建和编辑现在都在当前视口内完成。保存成功后你可以继续检查内容，再点击“关闭”退出弹窗。"
        className="max-w-[980px]"
        actions={
          <>
            <ActionButton variant="ghost" onClick={closeDialog} disabled={isSaving}>
              关闭
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => void handleSaveTopic()}
              disabled={isSaving || !draft.title.trim() || !draft.description.trim()}
            >
              {isSaving ? '保存中...' : dialogState?.type === 'create' ? '创建 Topic' : '保存修改'}
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
            {TOPIC_TEMPLATES.map((template, index) => (
              <button
                key={template.title}
                type="button"
                onClick={() => applyTemplate(index)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/72 transition hover:bg-white/9"
              >
                套用模板 {index + 1}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel label="议题标题" hint="一句话说清争议焦点，不要写成背景介绍。" />
              <TextInput
                className="mt-3"
                placeholder="例如：是否应在 90 天内上线公开版？"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel label="议题描述" hint="说明双方主要争议，以及需要考虑的核心变量。" />
              <TextArea
                className="mt-3 min-h-[150px]"
                placeholder="议题描述"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel label="附件上下文" hint="可继续上传文本、图片、PDF 或扫描件，保存后自动进入解析流程。" />
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[22px] border border-dashed border-white/12 bg-white/4 px-4 py-4 text-sm text-white/66 transition hover:bg-white/7">
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => setTopicFiles(Array.from(event.target.files ?? []))}
                />
                <StatusBadge tone={topicFiles.length > 0 ? 'info' : 'neutral'}>
                  {topicFiles.length > 0 ? `${topicFiles.length} files` : '选择附件'}
                </StatusBadge>
                <span>{topicFiles.length > 0 ? '保存 Topic 后将自动上传并解析。' : '支持文本、PDF、图片与扫描资料。'}</span>
              </label>
              {topicFiles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {topicFiles.map((file) => (
                    <StatusBadge key={`${file.name}-${file.lastModified}`}>{file.name}</StatusBadge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <details className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-white">高级规则与输出设置</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel label="补充背景" hint="可以补充业务约束、时间窗口、预算上限或外部事实。" />
                <TextArea
                  className="mt-3 min-h-[140px]"
                  placeholder="补充背景 / 约束条件"
                  value={draft.extraContext}
                  onChange={(event) => setDraft((current) => ({ ...current, extraContext: event.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel label="输出要求" hint="例如必须给出胜者、关键分歧和下一步建议。" />
                <TextArea
                  className="mt-3 min-h-[140px]"
                  placeholder="输出要求"
                  value={draft.outputRequirements}
                  onChange={(event) => setDraft((current) => ({ ...current, outputRequirements: event.target.value }))}
                />
              </div>

              <div>
                <FieldLabel label="最大轮次" />
                <TextInput
                  className="mt-3"
                  type="number"
                  min={1}
                  max={10}
                  value={draft.maxRounds}
                  onChange={(event) => setDraft((current) => ({ ...current, maxRounds: event.target.value }))}
                />
              </div>

              <div>
                <FieldLabel label="胜负规则" />
                <SelectInput
                  className="mt-3"
                  value={draft.winnerRule}
                  onChange={(event) => setDraft((current) => ({ ...current, winnerRule: event.target.value }))}
                >
                  <option value="hybrid">hybrid</option>
                  <option value="judge_score">judge_score</option>
                  <option value="last_active">last_active</option>
                  <option value="user_vote">user_vote</option>
                </SelectInput>
              </div>

              <div className="md:col-span-2">
                <FieldLabel label="辩论模式" hint="通常保持 hybrid；如果后续要扩专用流程，可以在这里提前区分。" />
                <SelectInput
                  className="mt-3"
                  value={draft.mode}
                  onChange={(event) => setDraft((current) => ({ ...current, mode: event.target.value }))}
                >
                  <option value="hybrid">hybrid</option>
                  <option value="knockout">knockout</option>
                  <option value="score">score</option>
                  <option value="synthesis">synthesis</option>
                </SelectInput>
              </div>
            </div>
          </details>

          <InlineHint>
            附件越具体，Judge 越容易得到稳定结论。尤其是 PDF 和 OCR 材料，建议尽量补充清楚来源与上下文。
          </InlineHint>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(isViewOpen && activeDialogTopic)}
        onClose={closeDialog}
        title={activeDialogTopic ? `${activeDialogTopic.title} · 详情` : 'Topic 详情'}
        description="这里展示完整的 Topic 资产信息，包括规则、附件与解析状态。查看结束后点击“关闭”即可回到列表。"
        className="max-w-[1080px]"
        actions={
          <>
            <ActionButton variant="ghost" onClick={closeDialog}>
              关闭
            </ActionButton>
            {activeDialogTopic ? (
              <ActionButton variant="secondary" onClick={() => openEditDialog(activeDialogTopic)}>
                编辑 Topic
              </ActionButton>
            ) : null}
          </>
        }
      >
        {activeDialogTopic ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_320px]">
            <div className="space-y-5">
              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Profile" title="议题说明" description="完整展示 Topic 的标题、描述、补充背景和输出要求。" />

                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={activeDialogTopic.status === 'ready' ? 'success' : 'warning'}>{activeDialogTopic.status}</StatusBadge>
                    <StatusBadge>{activeDialogTopic.mode}</StatusBadge>
                    <StatusBadge>{activeDialogTopic.winnerRule}</StatusBadge>
                    <StatusBadge>{activeDialogTopic.maxRounds} rounds</StatusBadge>
                  </div>

                  <div className="text-2xl font-semibold tracking-[-0.03em] text-white">{activeDialogTopic.title}</div>
                  <div className="text-sm leading-7 text-[var(--text-soft)]">{activeDialogTopic.description}</div>

                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/34">Extra Context</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/62">
                      {activeDialogTopic.extraContext || '当前还没有补充背景。'}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/34">Output Requirements</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/62">
                      {activeDialogTopic.outputRequirements || '当前还没有单独配置输出要求。'}
                    </div>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Attachments" title="附件与解析结果" description="帮助快速查看上下文材料是否已经准备充分。" />
                <div className="mt-5 space-y-3">
                  {activeDialogTopic.attachments.length > 0 ? (
                    activeDialogTopic.attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{attachment.fileName}</div>
                            <div className="mt-2 text-xs leading-6 text-white/42">
                              {attachment.extractionSummary || '等待附件解析摘要'}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <StatusBadge>{attachment.fileType || 'unknown'}</StatusBadge>
                              <StatusBadge>{attachment.characterCount ?? 0} chars</StatusBadge>
                              {attachment.pageCount ? <StatusBadge>{attachment.pageCount} pages</StatusBadge> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge tone={extractionTone(attachment.extractionStatus)}>{attachment.extractionStatus}</StatusBadge>
                            <StatusBadge>{attachment.extractionMethod}</StatusBadge>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState className="text-left">这个 Topic 还没有附件，上下文目前主要来自手工描述。</EmptyState>
                  )}
                </div>
              </SurfaceCard>
            </div>

            <div className="space-y-5">
              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Meta" title="时间信息" description="方便快速判断 Topic 最近的维护状态。" />
                <div className="mt-5 space-y-3 text-sm text-white/64">
                  <div>创建时间：{formatTimestamp(activeDialogTopic.createdAt)}</div>
                  <div>更新时间：{formatTimestamp(activeDialogTopic.updatedAt)}</div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="rounded-[24px] px-5 py-5">
                <SectionTitle eyebrow="Rule Snapshot" title="规则摘要" description="快速确认这条 Topic 在发起辩论时将带出的基本约束。" />
                <div className="mt-5 space-y-3">
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-white/62">
                    胜负规则：{activeDialogTopic.winnerRule}
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-white/62">
                    最大轮次：{activeDialogTopic.maxRounds}
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-white/62">
                    附件数量：{activeDialogTopic.attachments.length}
                  </div>
                </div>
              </SurfaceCard>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </AppShell>
  );
}
