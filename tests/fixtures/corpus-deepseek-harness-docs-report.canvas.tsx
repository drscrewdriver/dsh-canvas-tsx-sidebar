import {
  Callout,
  Card,
  Divider,
  Grid,
  H1,
  H2,
  MetricsGrid,
  ReportSection,
  ReportShell,
  Stack,
  Table,
  Tag,
  Text,
} from "qoder/canvas";

const headlineMetrics = [
  { label: "收集文档", value: "215", unit: "篇", description: "源 docs/ 全量 .md，中英对照" },
  { label: "中文版", value: "105", unit: "篇", description: "*.zh.md 双语覆盖" },
  { label: "总体积", value: "2.93", unit: "MB", description: "保留原始目录结构" },
  { label: "改进建议", value: "18", unit: "项", description: "P0 4 + P1 4 + P2 5 + 附项" },
];

const steps = [
  { step: "调研", action: "通过 GitHub API 摸清文档全貌，精读 36 篇核心文档（compaction、tools、session surface 等）" },
  { step: "定位", action: "发现本地已有完整源码缓存（commit 47f943859b，2026-08-13），改为本地复制，无需网络下载" },
  { step: "复制", action: "递归复制 215 个 md 到 deepseek-harness-docs/，保留目录结构，排除 i18n.yaml，逐文件核对无缺失" },
  { step: "索引", action: "生成 README.md 文档地图（89 个链接全部有效）与 SOURCE.md 来源记录及增量更新脚本" },
  { step: "分析", action: "产出 00-TOOL-CONTEXT-ANALYSIS.md：工具/上下文双维度分析 + inferglow 现状对比 + 18 项改进建议" },
];

const deliverables = [
  { file: "deepseek-harness-docs/README.md", role: "文档地图索引：目录分组、中英对照、inferglow 参考价值评级、阅读顺序、代理说明" },
  { file: "deepseek-harness-docs/SOURCE.md", role: "来源记录：git commit 47f943859b、分组统计、增量更新 PowerShell 命令" },
  { file: "deepseek-harness-docs/00-TOOL-CONTEXT-ANALYSIS.md", role: "核心分析报告：378 行，工具 A1-A6、上下文 B1-B5、对比 C1/C2、改进建议 D" },
  { file: "deepseek-harness-docs/ 215 篇文档", role: "8 分组：顶层 37、subsystems 92、user 26、cookbook 16、cordis-api 11、cordis-tutorial 16、postmortem 10、i18n 7" },
];

const verification = [
  { check: "文件完整性", result: "源 215 个全部复制，目标无缺失无多余（除 3 个新增交付物外）" },
  { check: "数量核对", result: "目标 218 md = 源 215 + README + SOURCE + 分析报告；分组与 GitHub 文件树一致" },
  { check: "链接有效性", result: "README 中 89 个相对 markdown 链接全部有效（脚本正则校验）" },
  { check: "报告结构", result: "A/B/C/D 四节 + P0/P1/P2 全部存在（UTF-8 读取验证）" },
  { check: "关键文件", result: "skills/tools/compaction/session/spill 等 16 个抽查文件全部存在" },
];

const improvements = [
  {
    tier: "P0",
    tone: "danger" as const,
    label: "高价值低风险",
    items: [
      "Action 输出契约：OutputSchema + Render 模型面投影（对标 ToolOutputDefinition）",
      "工具执行管线化：pre/post-execute 钩子 + 单调守卫（防绕过审批）",
      "压缩配对保护：tool-call/result 边界检查（对标 toolPairingBalanced）",
      "Spill 机制：MaxOutputBytes 超限落盘 + locator + retrievalHint",
    ],
  },
  {
    tier: "P1",
    tone: "warning" as const,
    label: "中期改进",
    items: [
      "compaction/* 锁事件 + 崩溃孤儿锁检测",
      "context-overflow 触发（provider 确认溢出）",
      "Token 测量从 len/4 估算升级（tokenizer / token-meter）",
      "ToolFilter 作用域继承语义（scope 链 intersect + 自身豁免）",
    ],
  },
  {
    tier: "P2",
    tone: "info" as const,
    label: "可选增强",
    items: [
      "isConcurrencySafe 并行调度（fail-closed）",
      "finalizeContent 内容不变量（恰好一次）",
      "presentCall/presentResult UI 卡片（generic/terminal/diff/search/read）",
      "callId 端到端追踪 + deferContext 嵌套上下文",
      "concludeTurn 回合终结标记",
    ],
  },
];

export default function DeepseekHarnessDocsReport() {
  return (
    <ReportShell width="wide" ariaLabel="DeepSeek Harness 文档收集与分析完成报告">
      <Stack gap="section">
        <header>
          <Stack gap="component">
            <H1>DeepSeek Harness 文档收集与分析</H1>
            <Text tone="secondary">
              来源 commit 47f943859b（2026-08-13）· 目标 e:\test\rewrite-agently\deepseek-harness-docs · 配套 inferglow 改进建议
            </Text>
            <MetricsGrid variant="header" columns={4} items={headlineMetrics} />
          </Stack>
        </header>

        <ReportSection title="关键步骤" divided>
          <Stack gap="component">
            {steps.map((s) => (
              <Stack key={s.step} gap="sm" align="start">
                <Tag>{s.step}</Tag>
                <Text>{s.action}</Text>
              </Stack>
            ))}
          </Stack>
        </ReportSection>

        <ReportSection title="变更文件" divided>
          <Table
            headers={["文件", "作用"]}
            rows={deliverables.map((d) => [d.file, d.role])}
            rowTone={["accent", undefined, undefined, undefined]}
          />
        </ReportSection>

        <ReportSection title="验证证据" divided>
          <Table
            headers={["验证项", "结果"]}
            rows={verification.map((v) => [v.check, v.result])}
            rowTone="success"
          />
          <Callout tone="success" title="交付验证全部通过">
            218 个文件（215 源文档 + 3 新增交付物）落盘完成；本任务为纯文档收集与分析，无运行时产物，不适用浏览器验证。
          </Callout>
        </ReportSection>

        <ReportSection title="核心分析结论" divided>
          <Stack gap="component">
            <H2>工具实现（deepseek-harness）</H2>
            <Text>
              ToolDefinition 采用输入/输出双 schema 契约，defineTool 全静态推断 + 运行时校验；执行走三层瀑布
              （pre-execute → 单调守卫 → execute → post-execute）→ finalizeContent → tools/result 冻结通知；
              白名单投影保证执行细节绝不上线；ToolRestriction 提供 scope 链继承过滤。inferglow 差距集中在输出契约、
              执行管线与端到端调用追踪。
            </Text>
            <Divider />
            <H2>上下文管理（deepseek-harness）</H2>
            <Text>
              Session surface 分离事件日志与派生模型历史，replace 影子化支撑范围替换式压缩；compaction/start|summary|end
              锁事件实现崩溃可检测；ToolResultPruner 确定性剪枝 + Spill 溢出落盘 + TokenMeter 独立测量。inferglow 在检索
              （三路融合）、9 层组装、长期记忆上领先，缺锁 / 配对保护 / 剪枝 / 溢出等安全语义。
            </Text>
            <Divider />
            <H2>改进建议总览（详见分析报告 D 节）</H2>
            <Grid columns={3} gap="component">
              {improvements.map((g) => (
                <Card key={g.tier} size="sm">
                  <Stack gap="component">
                    <Stack gap="sm" align="start">
                      <Tag tone={g.tone}>{g.tier}</Tag>
                      <Text weight="semibold">{g.label}</Text>
                    </Stack>
                    {g.items.map((it) => (
                      <Text key={it} size="small" tone="secondary">
                        {it}
                      </Text>
                    ))}
                  </Stack>
                </Card>
              ))}
            </Grid>
          </Stack>
        </ReportSection>

        <Text tone="tertiary" size="small">
          报告生成时间 2026-08-14 · 分析报告 00-TOOL-CONTEXT-ANALYSIS.md（378 行）· 18 项建议全部附 inferglow 源码位置
        </Text>
      </Stack>
    </ReportShell>
  );
}
