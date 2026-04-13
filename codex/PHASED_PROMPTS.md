# Phase 1：项目初始化

请检查当前仓库，补齐一个基于 Next.js App Router + TypeScript + Drizzle + PostgreSQL 的可运行最小项目骨架。
要求：
- 添加必要依赖
- 添加 drizzle.config.ts
- 添加 env.example
- 添加 db client
- 添加最小 README 启动说明
- 不引入不必要的 UI 库

# Phase 2：数据库与领域模型

请根据 `src/lib/db/schema.ts`：
- 生成迁移
- 添加 repository 层
- 实现 agents、topics、debate_sessions 的基本查询与创建
- 保证类型安全

# Phase 3：API 层

请实现以下 Route Handlers：
- POST /api/v1/agents
- GET /api/v1/agents
- POST /api/v1/topics
- GET /api/v1/topics
- POST /api/v1/debates
- POST /api/v1/debates/:id/start
- POST /api/v1/debates/:id/pause
- POST /api/v1/debates/:id/resume
- POST /api/v1/debates/:id/abort
- GET /api/v1/debates/:id/result

要求：
- 输入输出使用 Zod 校验
- 错误响应统一
- 业务逻辑移到 service 层

# Phase 4：状态机与 Orchestrator

请围绕 `src/lib/orchestration/debate-orchestrator.ts`：
- 实现 opening / critique / rebuttal / final / judging 的状态推进
- 实现 last checkpoint 持久化
- 实现 early stop 规则
- 先用 mock LLM adapter 跑通

# Phase 5：流式输出

请实现 `GET /api/v1/debates/:id/stream` 的 SSE 输出。
要求：
- 支持 TURN_STARTED / TURN_STREAM_DELTA / TURN_COMPLETED / SESSION_COMPLETED
- 前端能实时看到中间聊天区消息增长
- route.ts 保持精简

# Phase 6：Prompt 接入

请接入 `prompts/` 目录中的 Prompt v1：
- 写一个 prompt loader
- 写一个变量渲染器
- 让 orchestrator 在不同 phase 使用不同 prompt
- 先保留一个 mock provider 和一个真实 provider 接口

# Phase 7：UI 骨架

请根据参考 UI 风格，构建：
- 左侧：session / participants 列表
- 中间：chat timeline
- 右侧：detail panel
- 深色主题
- 不要先做复杂动效，优先结构和信息层级
