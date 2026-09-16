/**
 * A worked example of the shape a `.canvas.tsx` should take for the DSH sidebar.
 *
 * Every rule from the SKILL.md is exercised here, and `tests/skill.spec.ts`
 * renders this file and asserts that NOTHING degrades — no `unsupported` notice
 * and no unknown-component placeholder. If the guidance and the renderer ever
 * disagree, this file is where it shows up.
 *
 * What to copy:
 *   1. data and precomputed tone arrays as module-level `const` literals;
 *   2. `MetricsGrid` for the headline numbers (it reflows by itself);
 *   3. `Table` with `columns` + `rows`, three columns wide;
 *   4. braces inside prose escaped with a string expression.
 */
import {
  Callout,
  Code,
  Divider,
  Grid,
  H1,
  MetricsGrid,
  ReportSection,
  ReportShell,
  Stack,
  Stat,
  Table,
  Tag,
  Text,
  Timeline,
} from 'qoder/canvas';

// ── data ────────────────────────────────────────────────────────────────────
// Plain literals. The viewer resolves these by name; it never executes the file.

const headline = [
  { label: '新增云厂商', value: '2' },
  { label: '扫描方法', value: '32' },
  { label: '变更文件', value: '9' },
  { label: '新增代码行', value: '+1247' },
];

const vendorColumns = [
  { key: 'vendor', title: '厂商' },
  { key: 'sdk', title: 'SDK' },
  { key: 'auth', title: '认证' },
];

const vendors = [
  { vendor: '火山引擎', sdk: 'volcengine-python-sdk', auth: 'AK/SK' },
  { vendor: '百度云', sdk: 'bce-python-sdk', auth: 'AK/SK' },
  { vendor: 'AWS 中国区', sdk: 'boto3（复用 AwsClient）', auth: 'AK/SK' },
];

// A value the runtime could not derive is precomputed HERE, as a literal.
// `rows={vendors.map(v => v.auth === 'AK/SK' ? '…' : '…')}` would not resolve,
// and the prop would vanish with no warning.
const vendorTone = ['success', undefined, 'accent'];

const verificationRows = [
  ['注册表', '8 家：1/2/3/4/5/7/8/9（AWS 双注册），抽象方法全实现'],
  ['migration', '0004 已应用真实库，makemigrations --check 无遗漏'],
  ['真实库接口', 'access_list 正常；check-access-key 双分支拒绝逻辑实测正确'],
];

const events = [
  {
    timestamp: '08-13',
    title: '注册链路修复',
    description: 'clients/__init__.py 补齐 4 家子包导入，装饰器终于执行',
    state: 'completed',
  },
  {
    timestamp: '08-14',
    title: 'AWS / 华为云 Client 落地',
    description: '16 个抽象方法全部实现，mock 端到端入库通过',
    state: 'completed',
  },
  {
    timestamp: '08-15',
    title: '真实库回归',
    description: '订阅与租户字段写入真实库，前端表单按 cloud_type 派生 auth_type',
    state: 'current',
  },
];

// ── page ────────────────────────────────────────────────────────────────────

export default function CmpCloudSdkReport() {
  return (
    <ReportShell width="wide" ariaLabel="CMP 云厂商 SDK 补全完成报告">
      <Stack gap="section">
        <header>
          <Stack gap="component">
            <H1>CMP 云厂商 SDK 补全 — 完成报告</H1>
            <Text tone="secondary">spec/cmp-cloud-sdk · 2026-08-15 · 分支 feature/cmp-cloud-sdk · 提交 9dce20e</Text>
            <MetricsGrid columns={4} items={headline} />
          </Stack>
        </header>

        <Divider />

        <ReportSection title="关键修复" description="两个此前从未跑通的路径">
          <Stack gap="component">
            <Callout tone="info" title="注册链路从未生效">
              clients/__init__.py 此前未导入任何厂商子包，<Code>register_client</Code> 装饰器从未执行，
              注册表实际为空。已补齐 4 家子包导入。
            </Callout>
            <Callout tone="warning" title="sync_all 计数 bug">
              {
                'sync.py 全量同步中 int 与 dict 相加（0 + {\'created\': 1}）会抛 TypeError，'
              }
              该路径此前从未跑通。已新增 <Code>_merge_count</Code> 统一累加计数。
            </Callout>
          </Stack>
        </ReportSection>

        <Divider />

        <ReportSection title="新增 Client" description="补全后的厂商清单与认证方式">
          <Table columns={vendorColumns} rows={vendors} rowTone={vendorTone} />
        </ReportSection>

        <Divider />

        <ReportSection title="验证证据" description="L1 静态 / L2 import / L3 真实库链路">
          <Table headers={['验证项', '结果']} rows={verificationRows} rowTone="success" />
          <Grid columns={2} gap={16}>
            <Stat label="抽象方法实现" value="16/16" tone="success" />
            <Stat label="未完成项" value="0" tone="neutral" />
          </Grid>
        </ReportSection>

        <Divider />

        <ReportSection title="推进节奏">
          <Timeline events={events} />
          <Stack gap="component">
            <Text tone="tertiary">
              后续：Phase 2 覆盖 Azure 与 vCenter，认证模型不同，需单独立项。
            </Text>
            <Text>
              状态 <Tag tone="success">已交付</Tag> <Tag tone="warning">待排期</Tag> <Tag tone="info">进行中</Tag>
            </Text>
          </Stack>
        </ReportSection>
      </Stack>
    </ReportShell>
  );
}
