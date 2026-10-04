# 打点 · Dadian Game

中文多人回合制网页游戏，支持房间、账号、回合动作展示与结算记录。

- 公开源码：<https://github.com/jasonjin2021/dadian-game>
- 在线游戏：<https://dadian.yyxyzljyz.xyz>
- 技术栈：React、TypeScript、vinext / Vite、Cloudflare Workers 与 D1。

## 信息可见范围

玩家可以查看**自己的点数**，不能查看其他玩家的点数。血量、拳、盾等公开资源与已经公开的动作按游戏界面展示；不能根据展示动画推断尚未结算的伤害或胜负。完整动作规则见游戏内「规则」面板，实际结算由服务端处理。

此仓库不包含线上数据库、玩家账号、密码、会话、对局数据或生产环境凭据。本地启动使用独立的本地数据库；自行部署也需要创建自己的数据库。不要把线上数据导出到仓库。

## 本地运行

需要 Node.js **22.13.0 或以上**及 npm。建议使用当前受支持的 Node.js LTS 版本。

```sh
git clone https://github.com/jasonjin2021/dadian-game.git
cd dadian-game
npm ci
npm run dev
```

打开终端显示的本地地址。开发服务通过 Cloudflare 本地模拟器提供 `DB` 绑定，数据保存在被忽略的 `.wrangler/` 中。账号与房间所需数据表由应用初始化；请注册新的本地账号，不存在预置生产账号。

`.openai/hosting.json` 中的 `d1: "DB"` 是本地绑定名称；`project_id` 是无效占位标识，不授予任何线上项目权限。本地运行不需要生产数据库 UUID 或 API token。

## 测试与构建

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

测试覆盖规则结算、阶段计时、公开信息、账号逻辑、动作展示映射及音频等。发布音频通过固定 SHA-256 校验，不依赖未公开的原始音频目录。构建结果位于 `dist/`，不应提交。

## 部署到自己的 Cloudflare 账号

以下命令会登录并使用**你自己的** Cloudflare 账号创建资源、发布服务；不应在不了解目标账号时执行。

1. 安装依赖后登录并创建独立 D1 数据库：

   ```sh
   npx wrangler login
   npx wrangler d1 create dadian-game-db
   ```

2. 编辑 `wrangler.deploy.jsonc`：将 `d1_databases[0].database_id` 的占位 UUID 替换为刚创建的数据库 ID；保持 `binding` 为 `DB`。如数据库名称或 Worker 名称不同，同时调整 `database_name` 与 `name`。不要填写别人的生产数据库 ID。

3. 构建并按该配置部署：

   ```sh
   npm run build
   npx wrangler deploy --config wrangler.deploy.jsonc
   ```

4. 打开 Wrangler 返回的地址，注册测试账号并检查创建房间、加入房间和回合结算。应用首次使用数据库时初始化所需表。`drizzle/` 保留结构迁移记录，但不包含线上数据。

公开模板没有生产域名 `routes`，默认使用你自己的 `workers.dev` 地址。需要自定义域名时，在自己的 Cloudflare 账号中另行配置。不要直接把在线游戏的域名绑定到个人部署。密钥应交给 Cloudflare 的密钥管理或被忽略的本地环境文件，不能提交 Git。

## 仓库内容与素材

- `app/`：页面、组件、动画和接口入口。
- `lib/`：规则、房间、账号与纯逻辑测试。
- `db/`、`drizzle/`：数据库结构及迁移元数据。
- `public/gestures/`：当前运行使用的 26 个压缩 WebP 素材；不包括旧稿和源 PNG。
- `public/audio/`：大厅及结算所需音频、来源说明与已随附的许可证。
- `scripts/export-public-source.mjs`：从工作区生成白名单公开快照。

原音频库、原视频、下载页、下载记录、私人开发文档、工作文件、宣传图中间稿、数据库缓存与 Git 历史均不属于公开快照。

项目所有者已确认随项目公开上传当前音效与截图衍生素材。这项确认不构成对第三方著作权、肖像、声音或其他权利的额外担保；来源说明不等于对所有素材授予统一许可。现存单独许可证仅适用于其明确列出的素材，不能扩展到其他文件。

**公开可见不等于默认授予开源许可。** 本项目尚未提供统一开源许可证；本仓库没有通过 README 默示授予复制、修改或再分发全部代码及素材的权利。如需超出适用法律及平台规则允许范围的使用，请先向相关权利人确认。

## 维护公开源码快照

在维护工作区内，先检查白名单、配置占位和敏感内容，不写入任何文件：

```sh
node scripts/export-public-source.mjs --check
```

确认代码稳定并准备好导出后，再执行：

```sh
node scripts/export-public-source.mjs
```

脚本只写入 `work/github-dadian-game/`，不会修改源文件，不会执行 Git 操作、创建远程仓库或上传。首次目标目录必须不存在；重复更新必须有脚本的管理标记。遇到手工修改、非托管文件冲突或已经不在白名单中的旧文件时会停止，**不会自动删除文件**。发布前仍需在快照中重新安装依赖、运行测试、检查构建和核对待提交文件。
