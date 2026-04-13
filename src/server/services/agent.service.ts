import 'server-only';

import { pickRandomAgentAvatarUrl, resolveAgentAvatarUrl } from '@/lib/agents/avatar-presets';
import { invariant } from '@/lib/http/route';
import { ensureOwnerAccess, requireCurrentUser } from '@/server/auth/session.service';
import { getSystemModelById, listSystemModels } from '@/server/repositories/model.repository';
import { countAgentDebateUsages, createAgent, deleteAgent, getAgentById, listAgents, updateAgent } from '@/server/repositories/agent.repository';
import { resolveManagedModelConnection } from '@/server/services/model.service';
import { mapAgentListItem } from '@/server/services/view-mappers';

export async function createAgentService(input: {
  name: string;
  description?: string;
  avatarUrl?: string;
  modelId: string;
  systemPrompt: string;
  stylePrompt?: string;
  stanceTags?: string[];
  capabilities?: Record<string, unknown>;
  temperature?: string;
  maxTokens?: number;
}) {
  const owner = await requireCurrentUser();
  const nextAvatarUrl = input.avatarUrl?.trim() ? resolveAgentAvatarUrl(input.avatarUrl, input.name) : pickRandomAgentAvatarUrl();
  const selectedModel = await resolveManagedModelConnection({
    modelId: input.modelId,
    useCase: 'agent',
    strictSelection: true,
  });
  invariant(selectedModel, 'MODEL_REQUIRED', '每个 Agent 都必须绑定一个可用模型。');
  const row = await createAgent({
    ownerUserId: owner.id,
    name: input.name,
    description: input.description,
    avatarUrl: nextAvatarUrl,
    modelId: selectedModel.id,
    systemPrompt: input.systemPrompt,
    stylePrompt: input.stylePrompt,
    stanceTags: input.stanceTags,
    capabilities: input.capabilities,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });

  const model = row.modelId ? await getSystemModelById(row.modelId) : null;
  return mapAgentListItem(row, model);
}

export async function listAgentsService() {
  const owner = await requireCurrentUser();
  const rows = await listAgents(owner.id);
  const models = await listSystemModels();

  return rows.map((row) => mapAgentListItem(row, models.find((model) => model.id === row.modelId) ?? null));
}

export async function updateAgentService(
  agentId: string,
  input: {
    name: string;
    description?: string;
    avatarUrl?: string;
    modelId: string;
    systemPrompt: string;
    stylePrompt?: string;
    stanceTags?: string[];
    capabilities?: Record<string, unknown>;
    temperature?: string;
    maxTokens?: number;
  }
) {
  const owner = await requireCurrentUser();
  const existing = await getAgentById(agentId);
  invariant(existing, 'AGENT_NOT_FOUND', 'Agent not found.', 404);
  ensureOwnerAccess(existing.ownerUserId, owner.id);
  const nextAvatarUrl = input.avatarUrl?.trim()
    ? resolveAgentAvatarUrl(input.avatarUrl, existing.id)
    : resolveAgentAvatarUrl(existing.avatarUrl, existing.id);

  const selectedModel = await resolveManagedModelConnection({
    modelId: input.modelId,
    useCase: 'agent',
    strictSelection: true,
  });
  invariant(selectedModel, 'MODEL_REQUIRED', '每个 Agent 都必须绑定一个可用模型。');

  const row = await updateAgent(agentId, {
    name: input.name,
    description: input.description,
    avatarUrl: nextAvatarUrl,
    modelId: selectedModel.id,
    systemPrompt: input.systemPrompt,
    stylePrompt: input.stylePrompt,
    stanceTags: input.stanceTags,
    capabilities: input.capabilities,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });

  return mapAgentListItem(row, {
    id: selectedModel.id,
    displayName: selectedModel.displayName,
  });
}

export async function deleteAgentService(agentId: string) {
  const owner = await requireCurrentUser();
  const existing = await getAgentById(agentId);
  invariant(existing, 'AGENT_NOT_FOUND', 'Agent not found.', 404);
  ensureOwnerAccess(existing.ownerUserId, owner.id);

  const usageCount = await countAgentDebateUsages(agentId);
  invariant(
    usageCount === 0,
    'AGENT_IN_USE',
    '这个 Agent 已经被历史辩论引用，当前不能删除。你可以先停用它，或保留历史记录。'
  );

  const deleted = await deleteAgent(agentId);
  invariant(deleted, 'AGENT_DELETE_FAILED', 'Failed to delete agent.', 500);

  return {
    id: deleted.id,
    deleted: true,
  };
}
