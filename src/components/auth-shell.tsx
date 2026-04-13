'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useState } from 'react';

import { ActionButton, EmptyState, Eyebrow, FrameShell, InlineHint, PageCanvas, StatusBadge, SurfaceCard, TextInput, TitleBlock } from '@/components/ui/console-kit';

type AuthMode = 'sign-in' | 'sign-up';

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
  error?: {
    message?: string;
  };
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'Request failed.');
  }

  return payload.data;
}

export function AuthShell({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    identifier: '',
    password: '',
  });

  async function handleSubmit() {
    setPending(true);
    setError(null);

    try {
      await requestJson(mode === 'sign-up' ? '/api/v1/auth/sign-up' : '/api/v1/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify(
          mode === 'sign-up'
            ? {
                name: draft.name,
                email: draft.identifier,
                password: draft.password,
              }
            : {
                identifier: draft.identifier,
                password: draft.password,
              }
        ),
      });

      startTransition(() => {
        router.replace('/');
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '认证失败。');
    } finally {
      setPending(false);
    }
  }

  return (
    <PageCanvas className="flex items-center justify-center px-4 py-8">
      <FrameShell className="grid w-full max-w-6xl rounded-[34px] lg:grid-cols-[minmax(0,1.08fr)_460px]">
        <section className="hidden border-r border-white/10 p-10 lg:block">
          <SurfaceCard tone="accent" className="rounded-[30px] px-8 py-8">
            <Eyebrow>DebateOS Access</Eyebrow>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em]">
              把多 Agent 辩论，从试玩面板升级成真正可运营的工作系统。
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-[var(--text-soft)]">
              这里不是简单的“模型试验场”，而是一套可以持续沉淀角色、议题、会话和裁决资产的辩论操作台。管理员还能统一维护模型池，让不同 Agent 使用不同 provider。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <StatusBadge tone="info">权限登录</StatusBadge>
              <StatusBadge tone="success">模型治理</StatusBadge>
              <StatusBadge tone="warning">文件上下文</StatusBadge>
            </div>
          </SurfaceCard>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['真实登录', '账号体系、会话持久化与管理员权限已经接入。'],
              ['模型编排', '不同 Agent 可绑定不同模型，Judge 也有独立默认模型。'],
              ['附件理解', '文本、PDF、OCR 结果都可以进入辩论上下文。'],
              ['结构化裁判', '会输出分项评分、胜者解释与后续建议。'],
            ].map(([title, description]) => (
              <SurfaceCard key={title} className="rounded-[24px] px-5 py-5">
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{description}</div>
              </SurfaceCard>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-8 lg:p-10">
          <TitleBlock
            eyebrow={mode === 'sign-up' ? 'Create Account' : 'Sign In'}
            title={mode === 'sign-up' ? '注册 DebateOS 工作台' : '登录 DebateOS'}
            description={
              mode === 'sign-up'
                ? '首个注册账号会自动成为管理员，可继续维护模型注册表与系统级配置。'
                : '登录后继续管理你的 Agent、Topic、实时辩论会话，以及模型治理设置。'
            }
          />

          {error ? (
            <SurfaceCard className="mt-5 rounded-[24px] border-rose-400/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
              {error}
            </SurfaceCard>
          ) : null}

          <SurfaceCard tone="strong" className="mt-8 rounded-[30px] px-5 py-5">
            <div className="grid gap-4">
              {mode === 'sign-up' ? (
                <TextInput
                  placeholder="你的名字"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              ) : null}
              <TextInput
                type="text"
                placeholder={mode === 'sign-up' ? '邮箱' : '邮箱或用户名'}
                value={draft.identifier}
                onChange={(event) => setDraft((current) => ({ ...current, identifier: event.target.value }))}
              />
              <TextInput
                type="password"
                placeholder="密码（至少 8 位）"
                value={draft.password}
                onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
              />
            </div>

            <InlineHint className="mt-4">
              {mode === 'sign-up' ? '注册后会自动登录。' : '登录页已支持“邮箱或用户名”两种方式。'}
            </InlineHint>

            <ActionButton className="mt-6" variant="primary" block onClick={handleSubmit} disabled={pending}>
              {pending ? '提交中...' : mode === 'sign-up' ? '创建并进入工作台' : '登录并进入工作台'}
            </ActionButton>
          </SurfaceCard>

          <div className="mt-6 text-sm text-[var(--text-soft)]">
            {mode === 'sign-up' ? '已经有账号了？' : '还没有账号？'}{' '}
            <Link className="text-cyan-200 transition hover:text-cyan-100" href={mode === 'sign-up' ? '/sign-in' : '/sign-up'}>
              {mode === 'sign-up' ? '去登录' : '去注册'}
            </Link>
          </div>

          <EmptyState className="mt-8 lg:hidden">
            移动端同样可以完成登录、注册和管理员接入；更完整的模型治理与工作台体验建议在桌面端使用。
          </EmptyState>
        </section>
      </FrameShell>
    </PageCanvas>
  );
}
