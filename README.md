该项目目的是用来管理 当前机器上的已安装的 skills,提供一个可视化 UI 来管理skill

该项目是一个开 utools 插件的项目: utools 插件开发者文档:https://www.u-tools.cn/docs/developer/basic/getting-started.html ,请把这个开发者文档相关 信息更新到 AGENTS.md,以便后续可以参考开发,尤其是 API 相关信息



该项目目的是用来管理 当前机器上的已安装的 skills, 提供一个可视化 UI 来管理. 
可以配置管理哪些目录下的 skills,如:下面这些目录为全局目录,应该放在默认配置中.

- 项目配置：.opencode/skills/<name>/SKILL.md
- 全局配置：~/.config/opencode/skills/<name>/SKILL.md
- 项目 Claude 兼容：.claude/skills/<name>/SKILL.md
- 全局 Claude 兼容：~/.claude/skills/<name>/SKILL.md
- 项目代理兼容：.agents/skills/<name>/SKILL.md
- 全局代理兼容：~/.agents/skills/<name>/SKILL.md

关于 skill 就参考 skill 规范即可.

用户可以进行如下操作:
1.选择不同的 目录,可以查看该目录下有哪些 skills,分页列表展示,也要展示总数,并且下来选择目录时,支持多选,并且下拉框中需要展示每个目录有多少个 skills,可以通过 skill name 关键字检索
2.列表展示 skill 时,只需要展示信息 skill name + skill description 即可
3.可以对该 skill 进行管理,如删除,禁用(这里要思考下禁用 skill 该用什么方式实现,禁用的意思是不要让 agent 加载这个 skill),禁用后的 skill 也要展示在列表中,可以给一个筛选项进行筛选.

