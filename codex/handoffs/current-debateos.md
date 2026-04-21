# DebateOS Current Handoff

## 当前目标

- 持续把 DebateOS 打磨成可交付的多模型辩论工作台。
- 后续重点仍在实时辩论体验、管理端交互、真实使用流程验证。

## 当前进展

- 项目代码已迁移到仓库根目录 `debateos`。
- 多模型管理、Agent 选模、登录鉴权、附件上传与 PDF/OCR 已接通。
- `Agents` / `Topics` 管理页已经改成弹窗式查看、创建、编辑交互。
- 实时辩论页已做过多轮 UI 重构，时间线当前采用“摘要优先 + 预览优先 + 关键论点次级页”的结构。
- GitHub 推送问题已解决，仓库已改为 SSH 推送并成功推送到 `origin/main`。

## 已完成

- 多模型接入与管理界面
- Agent 单模型强绑定
- 登录、注册、会话鉴权
- Topic 附件上传与 OCR/PDF 解析
- Debate 工作台与时间线的多轮 UI 优化
- Git 仓库清理与 SSH 推送配置

## 关键决策

- Agent 只能绑定一个模型，运行时严格使用该模型，不允许静默回退。
- `public/uploads`、`.cache`、`*.tsbuildinfo` 不进入 Git。
- 实时辩论时间线默认优先展示“本轮摘要”和“内容预览”。
- “关键论点”作为次级页面展示，而不是和正文主视图混排。
- GitHub 推送使用仓库专用 SSH deploy key。

## 下一步优先级

1. 继续优化“实时辩论时间线”，重点是轮次分组、当前发言吸附、历史卡片降噪。
2. 对当前 UI 做一轮浏览器实测，检查移动端和桌面端的真实阅读效果。
3. 根据真实使用流程继续打磨 `Launch`、`Debates`、`Reports` 页的一致性。

## 关键文件

- [README.md](/Users/xiaoguangyang/Downloads/res/debateos/README.md)
- [debate-workspace.tsx](/Users/xiaoguangyang/Downloads/res/debateos/src/components/debate-workspace.tsx)
- [dashboard-shell.tsx](/Users/xiaoguangyang/Downloads/res/debateos/src/components/dashboard-shell.tsx)
- [agents-studio.tsx](/Users/xiaoguangyang/Downloads/res/debateos/src/components/agents-studio.tsx)
- [topics-studio.tsx](/Users/xiaoguangyang/Downloads/res/debateos/src/components/topics-studio.tsx)
- [model-registry.tsx](/Users/xiaoguangyang/Downloads/res/debateos/src/components/model-registry.tsx)
- [globals.css](/Users/xiaoguangyang/Downloads/res/debateos/src/app/globals.css)

## 验证

- `npx tsc --noEmit`
- `npm run build`

## Git / 发布状态

- 当前分支：`main`
- 远端：`origin` 已切换到 SSH
- 最近已知可用推送方式：直接执行 `git push`

## 下次续接提示词

```text
请基于 codex/handoffs/current-debateos.md 继续上次任务，先读取文件内容，总结当前状态，然后直接开始实现下一步优先级中的第 1 项。
```
