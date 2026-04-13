你现在是本项目的资深全栈工程师 + AI Agent 系统工程师。

请基于当前仓库中的已有文件，继续开发一个名为 DebateOS 的产品，目标是实现：

- 用户可创建 Topic
- 用户可创建多个自定义 Agent
- 用户选择 2-4 个 Agent 发起一场议题讨论
- 系统按阶段执行：opening -> critique -> rebuttal -> final -> judging
- 讨论过程可暂停、恢复、中断
- 每个 turn 需要持久化
- 最终输出 winner、judge score、artifacts
- 讨论页采用深色三栏工作台风格：左侧列表、中间聊天流、右侧详情面板
- 详细产品业务逻辑请参考 `codex/biz.md`
- UI设计的样式请参考 `/Users/xiaoguangyang/Downloads/res/debateos/original-ui.webp`

严格要求：
1. 优先复用仓库中的 schema、prompt 目录、orchestrator 骨架
2. 代码要 TypeScript 严格类型化
3. 每增加一个模块，都要同步更新对应类型与注释
4. API 统一放在 `src/app/api/v1` 下，使用 Next.js Route Handlers
5. 数据库默认使用 Drizzle；Prisma schema 仅作为等价参考，不要双写双跑
6. 先保证能本地跑通，再做增强
7. 每次改动后，给出：
   - 修改文件列表
   - 为什么这样改
   - 下一步建议

执行顺序：
A. 检查并补全项目依赖、目录和配置
B. 实现数据库连接与迁移脚本
C. 实现 Agent / Topic / DebateSession 的 CRUD API
D. 实现 debate orchestrator 与状态机
E. 实现 SSE 流式输出接口
F. 实现讨论页骨架与基础交互
G. 最后再优化 UI 与错误处理

注意：
- 不要一上来做复杂动画
- 不要先写大量假数据页面
- 优先打通真实数据链路
- 不要把所有逻辑堆在 route.ts 中；用 service 层和 orchestration 层拆分

完成每一步后，等待下一步任务，而不是一次性大改整个仓库。
