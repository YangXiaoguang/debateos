import type { ModelTransport } from '@/types/domain';

export type ManagedModelPreset = {
  id: string;
  label: string;
  provider: string;
  transport: ModelTransport;
  baseUrl: string | null;
  apiKeyEnvName: string | null;
  description: string;
  modelNameHint: string;
  notes: string;
};

export const MANAGED_MODEL_PRESETS: ManagedModelPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    provider: 'OpenAI',
    transport: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnvName: 'OPENAI_API_KEY',
    description: '官方 OpenAI Responses API，适合 GPT 系列模型。',
    modelNameHint: '填写你账号已开通的模型 ID',
    notes: '推荐给 Judge 或关键 Agent 使用；支持手工加密存储 API Key，也支持从环境变量读取。',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    provider: 'Anthropic',
    transport: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnvName: 'ANTHROPIC_API_KEY',
    description: 'Claude 官方 Messages API，适合长上下文分析与裁判评审。',
    modelNameHint: '填写你账号已开通的 Claude 模型 ID',
    notes: '可用于高质量裁判或策略型 Agent；手工密钥会以 APP_SECRET 加密后保存。',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    provider: 'Qwen',
    transport: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnvName: 'DASHSCOPE_API_KEY',
    description: '通义千问兼容 OpenAI 协议接入，适合构建多供应商 Agent 池。',
    modelNameHint: '填写你账号已开通的 Qwen 模型 ID',
    notes: '走 OpenAI-Compatible Chat 协议；通常需要显式填写 DashScope 兼容地址。',
  },
  {
    id: 'compatible',
    label: 'Compatible',
    provider: 'OpenAI-Compatible',
    transport: 'openai-compatible',
    baseUrl: '',
    apiKeyEnvName: '',
    description: '兼容 OpenAI Chat Completions 协议的第三方服务，例如私有网关或聚合路由。',
    modelNameHint: '填写第三方服务提供的模型 ID',
    notes: '请务必补齐 Base URL；适合 OpenRouter、企业代理、内部模型网关等场景。',
  },
  {
    id: 'mock',
    label: 'Mock',
    provider: 'System',
    transport: 'mock',
    baseUrl: '',
    apiKeyEnvName: '',
    description: '本地演示与联调用的无密钥模型。',
    modelNameHint: '例如 mock-debate-v1',
    notes: '不需要 API Key，适合本地 UI 验证、流程联调和离线演示。',
  },
];
