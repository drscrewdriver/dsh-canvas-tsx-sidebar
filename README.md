# dsh-canvas-tsx-sidebar

DSH（DeepSeek Harness）Web 插件 —— **dsh-better-sidebar 消费插件**。

把工作区里的 Qoder Canvas `*.canvas.tsx` **静态解析**为结构化页面，在 DSH 右侧栏渲染。

> **纯静态管线**：不执行 canvas 源码。无 `eval`、无 `new Function`、无 bundler、无沙箱 iframe。
> 解析在浏览器侧用自研的轻量递归下降解析器完成（零解析器依赖）。

---

## 前置

- DSH `dsh web` 可正常运行
- 已安装 [dsh-better-sidebar](https://www.npmjs.com/package/dsh-better-sidebar)（`>=0.19.1`）

未安装 better-sidebar 时插件**完全惰性**：注册被静默跳过，不影响 DSH 其他功能。

## 安装

### 方式 A（推荐，官方 CLI）

```sh
dsh plugin --profile <profile> add <dsh-canvas-tsx-sidebar-0.1.0.tgz>
```

`dsh` 会把本包加入 `dsh.profile.bundles`，启动时由本包自带的 `cordis.patch.yml`
插入 loader entry，并按 `entry.name` 注册下发客户端 bundle。

### 方式 B（手动，备选）

1. 把包复制到 `~/.dsh/profiles/<profile>/node_modules/dsh-canvas-tsx-sidebar`
   （或在 profile 的 `package.json` 的 `dependencies` 里加 `"dsh-canvas-tsx-sidebar": "link:<插件路径>"`）；
2. 把下面这行追加到 `~/.dsh/profiles/<profile>/cordis.patch.yml`：

   ```yaml
   - insert:
       - id: dsh-canvas-tsx-sidebar
         name: dsh-canvas-tsx-sidebar
   ```

3. 在 profile 目录执行 `pnpm install`。

> ⚠️ **方式 A 与方式 B 二选一，勿重复注册。**

### 生效

4. **重启 `dsh web`** —— 新增 bundle 需要宿主侧重载（对**已挂载**插件的 client 改动才只热加载）；
5. 浏览器硬刷新（Ctrl+Shift+R）。

可用 `pwsh -NoProfile -File ./scripts/mount-check.ps1` 复查挂载状态。

## 使用

在 DSH 右侧栏的 `+` 菜单里打开 **Canvas 报告**。插件会扫描当前会话工作区内的
`*.canvas.tsx`，选中后渲染为结构化页面。

> 本插件**不注册文件预览器**。打开 `.canvas.tsx` 不会自动进入本插件——原因见下节。

## 为什么是「页签」而不是「文件预览器」

这是本项目最关键的一个设计裁定，依据全部来自 better-sidebar 源码与生态实测：

| # | 约束 | 证据 |
|---|---|---|
| L1 | `extOf()` 只取最后一段扩展名 → `extOf('a.canvas.tsx') === 'tsx'` | `src/client/paths.ts:80-85` |
| L2 | 唯一能命中的 `exts: ['tsx']` 会认领工作区**全部** `.tsx`，且 priority 0 压掉内置 `code`（-100）的 CodeMirror | `service.ts:847-875` |
| L3 | `detect` 只在 `head` 字节可用时调用，而 `head` 仅来自二进制 `fs.read` —— 文本 `.tsx` 永远走不到该分支 | `service.ts:860` |
| L4 | descriptor 认领后 `component` 必须渲染，**无委托/回退 API**，误认领不可挽回 | `EditorHost.tsx:349,486` |
| L5 | 生态插件 `dsh-code-nav` 的 `LANG_EXT` **已含 `tsx`** 并以 `priority: 10` 认领 —— 我们低于它会永不触发，高于它会遮蔽它 | `dsh-code-nav/src/lang-registry.js` |

→ `.canvas.tsx` 的判定必须在自有组件内完成，因而必须自持文件选择 UX → **页签**。

## 版本约束

在 `dsh-better-sidebar@0.19.0 / 0.19.1` 上，`openTab({ path })` 的 path seed 会被改道到
文件编辑器，**组件型页签不会挂载**（上游 #632，0.19.2+ 修复）。因此本插件**不依赖 path seed**，
而是自行经 `/sidebar/api`（`session.cwd` → `fs.tree` → `fs.read`）解析目标文件——
该实现对 0.19.2+ 同样成立。

## 皮肤与主题

所有视觉值只消费 DSH 的 `--dsw-alias-*` 令牌，**零硬编码颜色**，自动跟随全部皮肤与深浅色
（`tests/theme.spec.ts` 守护）。调色板**不**取自 Qoder 自带的 `palettes.d.ts`。

## 开发

```sh
pnpm install
pnpm typecheck     # tsc（含仅客户端的零 Node 依赖校验）
pnpm test          # vitest
pnpm build         # tsc dts + tsdown（宿主半 + 客户端 bundle）
```

## 已知限制

- 解析为**轻量自研解析器**，非编译器级精度。复杂 TSX（泛型箭头函数、`as` 断言、装饰器）
  可能落入 `unsupported`，此时该节点渲染为行内降级条而非报错，**不是**整页失败。
- 仅支持 Qoder Canvas 的**声明式子集**：字面量 props。任何非字面量（变量、调用、
  `.map()`、条件表达式、成员访问、`{...spread}`）一律降级，**不做求值**：
  - 非字面量**子节点** → 渲染为行内降级条，片段原文可见；
  - 非字面量**属性** → 该属性被丢弃，名字记录在 IR 的 `unresolved` 里，其余属性照常渲染。
- 页签渲染为**只读**。
- **解析器比编译器更宽容**：Qoder SDK 要求作者用 IDE 的 "Canvas TypeScript check" 修掉诊断，
  但真实文件未必干净。本插件遇到非法 TSX **不报错、不中断**，只降级出问题的那个节点。
  可用 `node scripts/syntax-oracle.cjs <file.canvas.tsx>` 查看权威诊断。

  > 实测：仓库自带的样本 `cmp-cloud-sdk-report.canvas.tsx` 第 46 行
  > `{'created': ...}` 即为非法 TSX（TypeScript 报 **TS1005 + TS1381** —— 裸展开运算符）。
  > 本插件把该处降级为一个行内标记，其余 147 行照常渲染。

## JSX 空白语义

文本子节点严格按 React 的 `cleanJSXElementLiteralChild` 语义折叠：

- 非首行的**前导缩进一律剥离**；
- **末行的尾随空格保留** —— 这个空格是承重的，它分隔文本与紧随其后的表达式容器
  （例：`…相加（0 + {'created': ...}）…` 中的空格，去掉会让两段粘在一起）。

## 开发脚本

| 脚本 | 用途 |
|---|---|
| `scripts/dump-ir.ts` | 导出某文件的 IR 大纲 / JSON / 黄金夹具（`--write`） |
| `scripts/syntax-oracle.cjs` | 用**真实 TypeScript 编译器**判定源文件是否合法 TSX（`typescript` 仅为 devDependency，不进 bundle） |
| `scripts/audit-bundle.cjs` | 审计真实构建产物：内建模块泄漏、重解析器、`eval`、越界注册 |
| `scripts/mount-check.ps1` | 检查/修复 profile 挂载（纯 ASCII，兼容 Windows PowerShell 5.1） |

