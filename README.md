# 理想创作者服务平台

管理已发布、已完成外部上报的小红书笔记链接，跟踪每周发布进度与积分发放。

- 本周进度：按北京时间周一至周日统计，长期赛道和占额活动共用周名额，不占额活动单独跟踪。
- 发布记录：保存分享链接、标题备注、实际发布时间、赛道及发布时的积分规则快照。
- 积分台账：按公告覆盖的发布日期范围，批量登记日常、活动或全部积分；支持撤销和恢复，重叠批次不重复计算。
- 首页积分：按历史发放延迟预测近期可能到账的积分；登记本周到账后自动显示本周已到账积分。
- 活动与配置：维护长期话题、临时活动、积分规则版本及每月收集表地址。

系统不保存创作正文、图片、视频、发布包或手工待办。登记链接表示用户已完成小红书发布和外部表单上报。

## 代码与数据

本仓库为公开源码仓库。首次导入使用清理后的源码快照，没有携带早期单人版的 Git 历史。

- `lib/seed.json`：空白个人台账，仅包含通用长期赛道与默认规则。新身份从 0 篇文章、0 积分开始，收集表需自行配置。
- `tests/fixtures/creator-state.json`：虚构测试数据，链接使用 `example.com`，不对应真实用户或文章。
- 线上文章和积分保存在 Sites 绑定的 D1 数据库中，不随 Git 提交或克隆复制。
- `.wrangler/` 为独立的本地预览数据，不会上传；源码中也不包含登录令牌、真实台账、个人资料或群内表单地址。

已有线上用户的数据独立于初始化文件。后续部署空白初始化文件时，接口通过 `onConflictDoNothing()` 保留已存在的用户台账。

## 换电脑开发

需要 Git 与 Node.js 22.13 或更高版本；建议使用 Node.js 24。开发机可以是 macOS、Linux 或 Windows。

```sh
git clone https://github.com/JackyM06/ideal-creator-platform.git
cd ideal-creator-platform
npm run install:ci
npm test
npm run typecheck
npm run build
```

首次构建会生成本地 Wrangler 配置。先执行本地数据库迁移：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file drizzle/0000_acoustic_vance_astro.sql
```

初始 SQL 仅在新的本地数据库执行一次；后续只应用尚未执行的迁移。

然后启动本地预览：

```sh
npm run dev
```

默认地址为 `http://127.0.0.1:5173`。本地身份和数据库仅用于开发；本地预览不读取线上台账。

`npm run start` 运行本地生产构建，也需要本地数据库迁移。

## 更新网站

GitHub 保存源码，Sites 负责运行网站和持久化数据。推送 GitHub 当前不会自动上线。

原网站为 [理想创作者服务平台](https://ideal-creator-jacky.regal-teal-9114.chatgpt.site)。该网站的访问权限与本仓库的公开可见性分别管理。

在另一台电脑上，克隆本仓库后，可以把以下要求交给连接了 Sites 插件的开发助手：

> 以当前 GitHub 仓库为开发源码，继续更新已有的理想创作者服务平台。先阅读 AGENTS.md 和 docs/SITES.md，通过 Sites 工作流取回原站点的部署源码到独立目录，同步当前仓库的源码文件，保留原项目 ID、部署历史和数据库。完成测试和构建后，发布到原网站，保留它现有的访问权限。

详细的源码同步、部署及数据迁移说明见 [docs/SITES.md](docs/SITES.md)。

## 目录

| 路径 | 用途 |
| --- | --- |
| `app/dashboard.tsx` | 本周进度、发布记录及配置入口 |
| `app/settlement-desk.tsx` | 按时间范围登记发放批次 |
| `app/payout-metrics.tsx` | 预计到账与本周到账卡片 |
| `lib/model.ts` | 周额度、历史积分、批次匹配和发放预测 |
| `app/api/state/route.ts` | 登录身份校验、台账读取与版本冲突校验 |
| `db/`、`drizzle/` | D1 表结构和数据库迁移 |
| `.openai/hosting.json` | 原 Sites 项目标识及存储绑定，不含凭据 |

当前配置仍按用户独立保存，平台级超管和共享话题管理尚未实现。现有网站继续保留原访问范围。
