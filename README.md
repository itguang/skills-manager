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


把首页精简下:
1.只保留 skill 列表查看功能,排版要紧凑一点,因为 utool 插件默认打开窗口很小,你可以去 utool 开发者文档看下这个窗口大小,排版优美紧凑
2.把目录配置相关功能,放在一个单独的页面中,通过在主页面右下角放置一个设置按钮,点击后打开新页面进行目录配置.这里你自己思考,是打开新页面还是弹窗,选个交互友好的方式,并且目录配置也要排版紧凑优美
3.把 Skills Manager 这个模块组件和右边的 统计模块(总技能数,已启用,已禁用),重新排版,放在一个组件中,并且占据一行,排版紧凑优美,适应 utool 默认小窗口

技能描述,现在占满了一行,挤压了最右边技能状态的位置,修改下,技能描述最多占满一行 70%宽度,最多显示两行,超过之后可以通过展开/收起进
行展示
