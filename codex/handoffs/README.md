# Codex Handoffs

这个目录用来保存可续接的任务交接记录，避免关闭程序后重新解释上下文。

建议使用方式：

1. 当前任务进行到关键节点时，更新一份 handoff 文件。
2. 下次打开 Codex 时，直接引用这份文件继续。
3. 新任务可以从 [_template.md](/Users/xiaoguangyang/Downloads/res/debateos/codex/handoffs/_template.md) 复制一份。

推荐提示词：

```text
请基于 codex/handoffs/current-debateos.md 继续上次任务，先读取文件内容，再直接开始。
```

文件建议保持短而具体，只保留：

- 当前目标
- 已完成内容
- 关键决策
- 待办优先级
- 关键文件
- 验证方式

不要把整段聊天记录复制进来，handoff 的作用是“快速续接”，不是“完整归档”。
