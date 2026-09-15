# Qoder Canvas `.canvas.tsx` — 解析规则、编写规则与格式经济学

> **语料**:41 份真实 `.canvas.tsx`(20 个不同报告),取自
> `%APPDATA%\QoderCN\SharedClientCache\cache\workingSpace`(Qoder 内容寻址缓存),
> 加上 3 份跨项目样本。共 **2139 个 IR 节点 / 1727 个 prop / 1487 个组件实例**。
>
> **权威契约**:`~/.qoder/canvas/sdk/*.d.ts`(本机 SDK,含 `core-primitives` /
> `report-primitives` / `patterns` / `canvas-tokens` / `palettes`)与 7 份 `recipes/*.recipe.md`。
>
> 本文所有数字均由仓库脚本实测产出,可复现:
> `corpus-stats.ts` / `format-economics.ts` / `audit-corpus.ts` / `corpus-gaps.ts` /
> `syntax-oracle.cjs` / `component-census.cjs`。

---

## 0. 一句话结论

| 问题 | 答案 |
|---|---|
| 这个格式**省字节**吗? | **不省**。比等价 JSON 大 1.7%(raw)/ **19.7%**(gzip);是 Markdown 的 **1.94 倍**(gzip) |
| 它的**信息熵**高吗? | 组件选择的熵 **4.01 bits**,上限 4.52 → 冗余仅 **11.3%**,**接近均匀分布** |
| 那它的价值在哪? | **可类型检查**(39/41 对本机 SDK 零错误)+ **可组合**(`const` 复用、`.map()` 投影)+ **LLM 可写** |
| 79.6% 的字节花在哪? | 结构。而结构**信息密度高**,所以压不动 —— 这是"贵"的根源 |

---

## 1. 解析规则(读取端)

### 1.1 值解析:封闭规则集

值只经下列 **5 条封闭规则**解析。规则外一律不解析。**全部是语法重写,无 `eval`、无 `new Function`、无任意调用求值。**

| # | 形式 | 语义依据 |
|---|---|---|
| 1 | `undefined` / `null` | 是**关键字**不是表达式 → 归一为 `null` |
| 2 | `EXPR as const` / `EXPR as T` | **纯 TS 断言**,运行时被擦除 → 剥离后继续 |
| 3 | `NAME` → `const NAME = <可解析>` | 静态符号表;覆盖**模块级**与 **default 导出函数体直接声明**两层 |
| 4 | `ARR.map(() => LIT)` / `ARR.map(p => [p.a, p.b])` | 对**静态数组**的受限投影 |
| 5 | `canvasImage('lit')` | SDK 文档明示"use one direct string literal" → **恒等** |

**刻意拒绝**(边界,`tests/value.spec.ts` 9 条断言锁定):
嵌套调用 `f(x)`、条件表达式 `a ? b : c`、成员链 `a.b.c`、模板插值、
算术、`new`、IIFE、`await`、以及**嵌套块内**的 `const`(不做作用域分析)。

### 1.2 降级策略:两种失败走两条路

| 情形 | 处理 | 理由 |
|---|---|---|
| 非字面量**子节点** | `{kind:'unsupported'}` → 行内降级条 + 原文片段 | 内容缺失,必须可见 |
| 非字面量**属性** | 从 `props` 丢弃,名字记入元素的 `unresolved` | **元素仍渲染**,只丢那一个属性 —— 避免连带丢失 |
| 大写 tag **不在**映射表 | **透明容器**:原样渲染 children + 轻量标记 | 未映射的常是**布局容器**,整棵子树不能丢 |
| 小写 tag | 原生 HTML 透传 | — |

> **关键区分**:"这个表达式我求不了值"与"这个组件我不认识"是两件事,不能走同一条降级路径。

### 1.3 组件映射表(21 个)

布局/框架:`ReportShell` `ReportSection` `Stack` `Grid` `Divider` `Card` `CardHeader` `CardBody`
文本/内容:`Text` `H1` `H2` `H3` `Stat` `Tag` `Table` `Callout` `Code` `Pill` `Row`
复合模式:`Timeline` `MetricsGrid`

来源:对 41 份语料做通用跨行标签计数(`component-census.cjs`)得到 23 个不同 tag,
其中 2 个是小写原生 tag(`header` / `img`)。

### 1.4 关于"源文件非法"的准确表述

实测:`cmp-cloud-sdk-report.canvas.tsx` 第 46 行 `{'created': ...}`(三个 ASCII 句点 = 裸展开运算符)

| 解析器 | 结果 |
|---|---|
| TypeScript 编译器 | **2 条诊断**(TS1005 + TS1381) |
| esbuild | **1 条错误**(`Expected "}" but found ":"`) |

**两个独立解析器都拒绝它。** 但该报告在 Qoder 里**渲染正常**(用户实机观察)。

→ 合理推断:Qoder 的管线使用了**带错恢复的解析器**(如 Babel `errorRecovery: true`,
React 工具链默认),在报错的同时仍产出 AST 并渲染其余部分。

→ **这对本插件是正面证据**:若采用"严格编译器"方案,整份报告会**白屏**;
本插件只降级那一个节点、其余 147 行照常渲染 —— **行为与 Qoder 一致**。

**41 份语料的类型检查结果**(对本机 SDK,`tsc` + `paths` 映射):

```
TS diagnostics > 0 : 2 / 41   ← 同一个报告的 2 个修订版
其余 39 份         : 0 条
```

即 **95.1% 的真实文件是完全合法的 TSX**。"Qoder 写出来的都加载不了"这个猜测不成立 ——
但它确实发生过一次(同一份报告连出两版都带着同一个错)。

---

## 2. 编写规则(写入端)

面向**写 canvas 的模型/人**。每条都对应上面某条解析规则。

### 2.1 必须

1. **根组件用 `ReportShell`** —— recipe 明确要求,它负责居中(reading 640 / wide 960)与页边距。
   ⚠️ 但 41 份语料里**只有 24 份这么做**,`gymnasium` / `pendulum` 等直接用裸 `Stack`。
   渲染器必须容忍缺失并补默认页框。
2. **数据表用模块级或函数体 `const` 字面量** —— 两条作用域都支持查表。
3. **数组投影用 `.map(p => [p.a, p.b])`** —— 这是唯一被支持的 `map` 形态。
4. **`undefined` 可以出现在数组里**(表示"该行用默认色"),会被归一为 `null`。
5. **类型断言随便写** —— `as const` / `as T` 都会被剥离。

### 2.2 禁止(会降级)

| 反模式 | 后果 | 改为 |
|---|---|---|
| JSX 文本里写裸 `{...}` 当**散文字面** | **整个文件语法非法**,部分渲染器可能白屏 | 转义:`{'{'}...{'}'}` 或写成 `{'...'}` |
| `rowTone={tasks.map(t => statusTone(t.status))}` | 属性被丢弃 | 在 `const` 里预计算好字面量数组 |
| `rows={tasks.map(t => [..., t.x ? 'A' : 'B'])}` | 属性被丢弃(含条件) | 预计算 |
| 嵌套块内声明数据表 | 不查表 | 提到函数体顶层或模块级 |
| 从别的模块 `import` 数据 | 不查表 | 内联为字面量 |

### 2.3 最重要的一条:JSX 里的 `{` 是**语法**,不是文本

`（0 + {'created': ...}）` 想表达的是"展示这段文本",但 JSX 把 `{...}` 读成**表达式容器**,
于是 `'created': ...` 被当作对象字面量、`...` 当成裸展开运算符 → 语法错误。

**这正是那份报告唯一的问题**,也是 26 个 `unsupported` 节点(8 份文件)的**全部来源**。

---

## 3. 格式经济学:省字节吗?熵高吗?

### 3.1 字节对比(同一棵 IR,只换编码)

| 编码 | raw | 相对 source | gzip -9 | 相对 source-gz |
|---|---:|---:|---:|---:|
| **`.canvas.tsx`(源)** | 282,020 B | 1.00x | **82,364 B** | 1.00x |
| IR as JSON | 277,376 B | 0.98x | 68,790 B | **0.84x** |
| HTML 投影 | 232,768 B | 0.83x | 65,165 B | 0.79x |
| Markdown 投影 | 128,886 B | **0.46x** | 42,542 B | **0.52x** |

**结论:**
- **比 JSON 大** —— raw +1.7%,**gzip 后 +19.7%**。JSX 的标签尖括号与缩进**压不掉**。
- **是 Markdown 的 1.94 倍**(gzip)。也就是说,**同样的内容用 Markdown 表达能省近一半字节**。
- 有趣的反转:**prose 只占 raw 的 20.4%,却占 gzip 后的 70%** ——
  gzip 把结构性冗余吃掉了,剩下的大头是不可再压的中文正文。

### 3.2 结构开销

```
structure overhead : 79.6% 的 raw 字节不是正文
bytes per node     : 131.8 raw / 38.5 gz
bytes per prop     : 163.3 raw / 47.7 gz
```

单文件结构/正文比跨度 **2.5x ~ 15.6x**(`windows-sandbox-backend-report` 是 15.6x ——
6905 字节里只有 443 字节正文,其余全是表格与图表结构)。

### 3.3 信息熵:组件选择的分布

1487 个组件实例,23 个不同组件:

```
top  3 of 23 -> 37.5% of all instances
top  5 of 23 -> 52.7%
top  8 of 23 -> 70.7%
top 12 of 23 -> 82.6%
top 16 of 23 -> 90.7%

Shannon entropy : 4.01 bits/instance
uniform (max)   : 4.52 bits/instance
redundancy      : 11.3%
```

**结论:冗余只有 11.3%,接近均匀分布。** 含义是:
- 用 Huffman 式"高频标签用短码"最多只能省 **11.3%** —— **不值得做**。
- 组件词表**没有长尾**:`long tail: 0 of 23 components appear in exactly ONE file`。
  每个组件都被 ≥3 份文件使用,最小的 `Pill` 也有 3 份。
- 也就是说,这 23 个组件都是**真实承载信息**的,不是冗余词汇。

### 3.4 综合论证

**格式贵在哪**:79.6% 的字节是结构,而结构里组件选择的熵接近上限(4.01/4.52),
**不可压缩、不可用短码优化** —— 这是"贵"的数学原因。

**那为什么还用它**:

| 维度 | `.canvas.tsx` | JSON IR | Markdown |
|---|---|---|---|
| 字节(gzip) | 82 KB | **69 KB** | **43 KB** |
| 类型检查 | ✅ 对本机 SDK 直接 `tsc` | ❌ 需另写 schema | ❌ 无 |
| 数据复用 / `.map()` 投影 | ✅ | ❌ | ❌ |
| 交互组件(Timeline/Card/MetricsGrid) | ✅ | 需自定义渲染器 | ❌ |
| LLM 训练语料覆盖 | ✅ 高 | 低 | 高 |
| 组件词表稳定性 | 23 个,零长尾 | 需维护 | — |

**裁定**:这个格式**不是在省字节,而是在买"可检查性 + 可组合性"**。
近 2 倍于 Markdown 的体积,换来的是类型安全与结构表达力。

对**本插件**的直接影响:
1. 不需要为"省字节"做任何标签压缩(最多省 11.3%,不值得);
2. 真正值得做的是**缓存解析结果**(IR),因为 JSON 比源小 19.7%(gzip),
   且解析是一次性成本;
3. 若未来要压传输,压的是**结构语法**而不是词表 —— 但更实际的做法是直接传 IR。

### 3.5 语义密度对比: .canvas.tsx vs HTML vs Markdown

核心问题:同等可渲染产出下,信息熵(每符号语义量)是否优于 HTML?

**实测数据**(8 份语料,285 个组件实例):

| 编码 | 总字节 | 每组件字节 | 信息密度(单位/KB) |
|---|---:|---:|---:|
| `.canvas.tsx` | 54,150 | 190 | 7.20 |
| HTML(紧凑序列化) | 33,684 | 118 | 11.58 |
| Markdown | 11,484 | 40 | 33.96 |

**HTML 字节更少**——因为 TSX 包含 code overhead(import/const/function 包装),
而 HTML 序列化器只输出纯标记。

**但信息熵(每符号语义量)是 TSX > HTML:**

```
TSX:  <Table data={vendors} columns={cols}/>
      → 1个符号 "Table" = 表格语义 + 列定义 + 数据绑定

HTML: <div style="overflow-x:auto;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <thead style="background:#f9fafb"><tr>
            <th style="padding:8px 12px;...">Vendor</th>...
      → 同样语义,需要 15+ 个符号(标签+属性)来描述
```

每个 JSX 组件标签 = 1个**高熵符号**(直接编码"是什么")
每个 HTML 标签 = 1个**低熵符号**(只描述"怎么渲染",需额外属性理解语义)

code overhead 买到的是: `const` 复用 + `tsc` 类型检查 + `.map()` 投影。

**Markdown 表现力远低于 TSX:**

| 结构 | TSX | HTML | Markdown |
|---|:---:|:---:|:---:|
| Grid 多列布局 | ✅ | ✅ | ❌ 退化为平铺 |
| MetricsGrid 指标卡 | ✅ | ✅ | ❌ 退化为 bullet |
| Timeline 时间线 | ✅ | ✅ | ❌ 退化为 bullet |
| Card 边框/阴影 | ✅ | ✅ | ❌ 丢失 |
| Pill/Badge 样式 | ✅ | ✅ | ❌ 退化为 `code` |
| 嵌套 Row/Column | ✅ | ✅ | ❌ 完全丢失 |

Markdown 字节少的原因不是编码效率高,而是结构信息被丢弃了——有损压缩。

---

## 4. 语料画像(长尾分析)

```
bytes (UTF-8)    min 3850  p25 6647  median 6905  p75 7958  p90 8077  max 8796  mean 6878
lines            min  109  p25  124  median  149  p75  173  p90  184  max  251
IR nodes         min   23  p25   36  median   49  p75   62  p90   75  max  149
components/file  min    9  p25   10  median   12  p75   12  p90   14  max   14
```

**分布非常紧**:字节数 max/min 只有 **2.3 倍**。这是个**高度同质**的格式 ——
没有真正的离群样本。

| 长尾维度 | 实测 |
|---|---|
| 组件词表长尾 | **0**(23 个组件全部被 ≥3 份文件使用) |
| 字节离群(largest) | `agently-sandbox-plugin-report` 8796B / 251 行(但只 57 节点 —— 大量正文或大 const 表) |
| 字节离群(smallest) | `react-migration-report` 3850B / 127 行,**却 62 节点** —— 数据在函数体 const 里,正文比最高 |
| 组件数最多 | 14(三份并列) |

**真正的"长尾"不在格式,在写法**:41 份里唯一破坏性的差异是那份把 `{...}` 当散文字面写的
报告 —— 它不是"罕见语法",而是**一个会被复制传播的错误写法**(同一报告 2 个修订版都带着它)。
