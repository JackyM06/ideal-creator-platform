# 开发源码与 Sites 部署

## 已有项目

- GitHub：`https://github.com/JackyM06/ideal-creator-platform`
- 网站：`https://ideal-creator-jacky.regal-teal-9114.chatgpt.site`
- 项目 ID：从 `.openai/hosting.json` 原样读取。
- 数据库绑定：`DB`，由 Sites 提供 Cloudflare D1。

项目 ID 是部署标识，不是访问凭据。能读取公开代码不意味着有权访问网站、数据库或部署项目。

## 为什么源码历史分开

早期 Sites 源码历史包含单人版导入的真实台账。公开仓库从清理后的文件创建首次提交，保留公开仓库自己的历史；原 Sites 仓库继续保留部署历史。二者的文件可以同步，不能直接将早期 Sites 提交推送到公开 GitHub。

开发工作在 GitHub 克隆目录完成。部署时，Sites 插件在另外一个空目录取回原项目源码，再同步 GitHub 的当前文件。换电脑后仍按相同流程执行。

## 一次正常发布

1. 在 GitHub 开发目录更新代码，运行 `npm test`、`npm run typecheck` 和 `npm run build`，提交并推送。
2. 使用 Sites 插件读取原项目的状态、权限与源仓库凭据；原样使用 `.openai/hosting.json` 中的 ID，不新建站点。
3. 在独立部署目录，通过插件当前的 `site-workflow.mjs` 打开原项目源码。项目已存在时，先完成打开和同步，再修改该目录。
4. 确认部署目录没有未提交的用户修改后，将 GitHub 当前提交里的受版本管理源码同步进去；保留部署目录的 `.git`，本地工具状态也不复制。删除旧源码文件前确认它已从 GitHub 当前版本移除。
5. 保留原项目 ID、`DB` 绑定和访问范围，检查差异。执行测试、类型检查、构建，通过 Sites 源码工作流提交、推送和打包部署目录。
6. 使用 Sites 返回的提交 SHA 和构建包发布，等待成功结果。将该次 GitHub 提交与 Sites 版本的对应关系记在发布说明中。

临时凭据通过工具的隐藏 stdin 传递，不放进 URL、环境配置文件或命令参数。每台电脑以当前安装的 Sites 插件脚本路径为准，不复制其他电脑的绝对路径或凭据。

不要把 GitHub 的干净初始提交直接强制推到原 Sites 分支。Sites 工作流会拒绝分叉的历史，使用独立部署目录同步文件即可保留两侧历史。

## 数据保持与迁移

- 线上用户台账是 D1 的 `creator_state` 记录，按登录用户 ID 分开存储。
- 发布代码不会导入开发机 `.wrangler/` 数据；克隆 GitHub 也不会下载线上台账。
- `lib/seed.json` 只用于没有数据的新身份，默认 0 篇文章、0 个个人发放批次、空白个人资料和空表单列表。旧用户已有记录由接口的插入冲突处理保留。
- 已有数据库迁移文件不可覆盖修改。以后变更表结构时，使用 `npm run db:generate` 新增迁移，核对生成 SQL，再按 Sites 流程发布。
- 当前仓库不包含线上数据备份或自动备份功能。需要备份时单独导出并保存在受控位置。

## 本地迁移

先运行 `npm run build` 生成本地配置，再执行：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file drizzle/0000_acoustic_vance_astro.sql
```

初始 SQL 仅在新的本地数据库执行一次；后续只应用尚未执行的迁移。上述命令仅使用 `--local`，不会连接线上数据库。
