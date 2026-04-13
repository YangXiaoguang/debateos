# DebateOS

这是 DebateOS 的当前工作目录，项目已经从 `debateos-codex-starter` 整体迁移到了 `debateos` 根目录，并继续在 `Next.js + TypeScript + PostgreSQL + Drizzle` 路线上演进。

## 包含内容

- `codex/MASTER_PROMPT.md`：给 Codex 的主任务提示词
- `codex/PHASED_PROMPTS.md`：分阶段执行提示词
- `src/lib/db/schema.ts`：Drizzle schema
- `prisma/schema.prisma`：Prisma 等价 schema
- `src/lib/db/client.ts`：Drizzle client
- `drizzle.config.ts`：Drizzle 配置
- `src/lib/prompts/*`：Prompt 载入与模板渲染工具
- `prompts/*`：Prompt v1 文件
- `src/lib/orchestration/debate-orchestrator.ts`：讨论状态机骨架
- `src/app/api/v1/**`：API Route Handlers 骨架
- `src/types/domain.ts`：核心领域类型
- `src/app/debates/[id]/page.tsx`：讨论页骨架

## 建议技术路线

- Next.js App Router
- PostgreSQL
- Drizzle ORM
- Zod
- Server-Sent Events（SSE）用于流式输出

## 立即开工顺序
- 详细产品业务逻辑请参考 `codex/biz.md`
- UI设计的样式请参考 `/Users/xiaoguangyang/Downloads/res/debateos/original-ui.webp`
1. 让 Codex 先执行 `codex/MASTER_PROMPT.md`
2. 再按 `codex/PHASED_PROMPTS.md` 逐段推进
3. 先跑通数据库迁移与基础 CRUD
4. 再接讨论状态机与流式输出
5. 最后接 Prompt 与 UI

## 当前实现状态

当前仓库已经补齐为一个可运行的 DebateOS MVP 工程骨架，包含：

- Next.js App Router + TypeScript + Tailwind 4 基础工程
- Drizzle + PostgreSQL 数据层
- 真实登录/注册、会话鉴权与管理员角色
- 模型注册表与多模型 provider（Mock / OpenAI / OpenAI-Compatible / Anthropic）
- 管理员手工录入加密 API Key、环境变量映射与模型连通性测试
- Agent / Topic / Debate 的 CRUD API
- Topic 附件上传与辩论上下文接入
- PDF 文本提取、图片 OCR 与扫描版 PDF OCR fallback
- Debate orchestrator、状态推进与 Prompt 接入
- SSE 流式输出与会话内存事件总线
- 更强的 Judge 评分上下文与胜出解释
- 深色三栏工作台 UI

## 快速启动

1. 安装依赖

```bash
npm install
```

2. 准备环境变量

```bash
cp env.example .env.local
```

3. 确保本地 PostgreSQL 已启动，并且 `DATABASE_URL` 可连接

4. 生成迁移

```bash
npm run db:generate
```

5. 执行数据库变更

```bash
npm run db:migrate
```

6. 启动开发服务器

```bash
npm run dev
```

7. 打开 `http://localhost:3000`

## 默认运行模式

- 默认使用 `mock` LLM provider，因此没有 API Key 也能跑完整个讨论流程
- 管理员可在 `/settings/models` 中维护模型注册表、手工录入加密 API Key、测试连接，并让 Agent/Judge 选择不同模型
- Agent 显式绑定的模型会严格生效；如果该模型缺少有效密钥，运行时会直接报错而不是静默回退
- 未显式绑定模型时，系统仍可回退到默认 provider 或 `mock`

## 认证与模型

- `/sign-up`：注册；首个账号自动成为管理员
- `/sign-in`：登录
- `/settings/models`：管理员维护模型池、默认 Agent/Judge 模型、环境变量映射与手工加密密钥
- 内置预置模板：`OpenAI`、`Claude`、`Qwen`、`OpenAI-Compatible`、`Mock`
- 每个 Agent 可以在创建时独立选择模型，例如 `agent1 -> OpenAI`、`agent2 -> Claude`、`agent3 -> Qwen`

## 附件与上下文

- Topic 支持上传附件到 `public/uploads/topics/*`
- 文本类附件会提取正文并注入辩论 prompt
- PDF 会优先提取可搜索文本，必要时自动降级到 OCR
- 图片与扫描版资料会走 OCR，并把抽取状态、错误、页数、置信度写入元数据
- 首次 OCR 可能稍慢，因为需要下载语言包；可通过 `OCR_LANGUAGES` 与 `OCR_LANG_PATH` 进一步调整

## 主要页面

- `/`：Dashboard，创建 Agent / Topic / Debate Session
- `/sign-in`：登录页
- `/sign-up`：注册页
- `/settings/models`：模型管理界面
- `/debates/[id]`：三栏工作台，支持 Start / Pause / Resume / Abort / SSE

## 主要 API

- `POST /api/v1/auth/sign-up`
- `POST /api/v1/auth/sign-in`
- `POST /api/v1/auth/sign-out`
- `GET /api/v1/auth/session`
- `GET/POST /api/v1/models`
- `PATCH /api/v1/models/:id`
- `POST /api/v1/models/:id/test`
- `GET/POST /api/v1/agents`
- `GET/POST /api/v1/topics`
- `GET/POST /api/v1/topics/:id/attachments`
- `GET/POST /api/v1/debates`
- `GET /api/v1/debates/:id`
- `POST /api/v1/debates/:id/start`
- `POST /api/v1/debates/:id/pause`
- `POST /api/v1/debates/:id/resume`
- `POST /api/v1/debates/:id/abort`
- `GET /api/v1/debates/:id/stream`
- `GET /api/v1/debates/:id/result`
- `POST /api/v1/turns/:turnId/favorite`

admin@debateos.local / debateos123