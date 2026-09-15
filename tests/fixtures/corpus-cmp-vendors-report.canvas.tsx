import {
  H1,
  H2,
  Text,
  Stack,
  Grid,
  Divider,
  Stat,
  Table,
  ReportSection,
  ReportShell,
  Callout,
  canvasImage,
} from 'qoder/canvas';

const dropdownShot = canvasImage('./qa-cmp-dropdown.png');
const azureShot = canvasImage('./qa-cmp-azure-form.png');
const aliShot = canvasImage('./qa-cmp-ali-form.png');

export default function CmpVendorsReport() {
  return (
    <ReportShell width="wide" ariaLabel="CMP 四家新云厂商接入与认证扩展完成报告">
      <Stack gap="section">
        <header>
          <Stack gap="component">
            <H1>CMP 四家新云厂商接入与认证扩展 — 完成报告</H1>
            <Text tone="secondary">
              Spec: CMP 四家新云厂商与认证扩展 · 2026-08-17 · 分支 feature/cmp-cloud-sdk · 3 个提交（1b2eea7 / f2ea9c1 / 71a68a5）
            </Text>
            <Grid columns={4} gap={16}>
              <Stat value="4" label="新增云厂商" />
              <Stat value="8" label="注册厂商总数" />
              <Stat value="3" label="提交数" />
              <Stat value="+700" label="新增代码行" />
            </Grid>
          </Stack>
        </header>

        <Divider />

        <ReportSection
          title="关键成果"
          description="四家新厂商接入、DNS 记录补全、认证模型扩展三线并进"
        >
          <Stack gap="component">
            <Callout tone="info" title="常量收敛">
              新建 cloud_types.py 作为编号与认证类型唯一事实来源（9 家映射），
              消除 api_views / opsany_api / registry 三处重复；normalize_auth_type 向后兼容 'ak' 与 '1'。
            </Callout>
            <Callout tone="warning" title="DNS 补全">
              腾讯云 scan_domains 与 scan_domain_records 原本都缺失（只补 records 会因无域名数据源而空转），
              已同批补全；AWS 记录字段名与模型不匹配的既有 bug 一并修复。
            </Callout>
          </Stack>
        </ReportSection>

        <Divider />

        <ReportSection title="新增云厂商" description="按 cloud_type 编号注册，全部复用既有 13 抽象方法契约">
          <Table
            headers={['编号', '厂商', 'SDK', '认证', '实现范围']}
            rows={[
              ['7', '火山引擎', 'volcengine-python-sdk', 'AK/SK', 'regions/zones/hosts/disks/vpcs/security_groups/eips'],
              ['8', '百度云', 'bce-python-sdk', 'AK/SK', 'regions 硬编码 + hosts/disks/vpcs/security_groups/eips'],
              ['9', 'AWS 中国区', 'boto3（复用 AwsClient）', 'AK/SK', '双注册 3+9，默认 region cn-north-1 + endpoint 逃生口'],
              ['5', 'Azure 国际版', 'azure-identity + azure-mgmt-*', '订阅+租户（auth_type=3）', 'regions/hosts/disks/vpcs/security_groups/eips/rds/redis'],
            ]}
          />
          <Text tone="secondary" size="small">
            base.py 铁律：不新增任何抽象方法，未实现能力以可选方法默认空实现降级，同步层自动跳过。
          </Text>
        </ReportSection>

        <Divider />

        <ReportSection title="认证模型扩展" description="CloudAccess 新增字段，check-access-key 按 auth_type 分支">
          <Table
            headers={['变更', '说明']}
            rows={[
              ['models.py + migration 0004', 'subscription_id / tenant_id（可空），对既有记录零影响，已应用真实库'],
              ['check-access-key 分支校验', "auth_type='3' 要求订阅ID+租户ID+AppID/Secret；'1' 路径字节级不变"],
              ['api_views 透传', 'create / update / detail 全链路携带订阅与租户字段'],
              ['前端表单', 'auth_type 按 cloud_type 派生（5→3，其余→1），不再硬编码 ak'],
            ]}
          />
        </ReportSection>

        <Divider />

        <ReportSection title="浏览器走查证据" description="云账号管理页实测（qa_vendors 登录，无 4xx/5xx）">
          <Grid columns={3} gap={16}>
            <Stack gap="component">
              <img src={dropdownShot} alt="云类型下拉 8 项" style={{ width: '100%', borderRadius: 8 }} />
              <Text tone="secondary" size="small">云类型下拉恰好 8 项：阿里云/腾讯云/AWS/华为云/Azure/火山引擎/百度云/AWS 中国区</Text>
            </Stack>
            <Stack gap="component">
              <img src={azureShot} alt="Azure 动态表单" style={{ width: '100%', borderRadius: 8 }} />
              <Text tone="secondary" size="small">选择 Azure 后出现订阅 ID / 租户 ID，AK 标签切换为 Application (Client) ID / Client Secret</Text>
            </Stack>
            <Stack gap="component">
              <img src={aliShot} alt="阿里云表单恢复" style={{ width: '100%', borderRadius: 8 }} />
              <Text tone="secondary" size="small">切回阿里云后订阅/租户字段消失，恢复 Access Key ID / Secret</Text>
            </Stack>
          </Grid>
        </ReportSection>

        <Divider />

        <ReportSection title="验证证据" description="后端实测（真实 PostgreSQL 库）">
          <Stack gap="component">
            <Table
              headers={['验证项', '结果']}
              rows={[
                ['注册表', "8 家：1/2/3/4/5/7/8/9（AWS 双注册），抽象方法全实现"],
                ['migration', '0004 已应用真实库，makemigrations --check 无遗漏'],
                ['真实库接口', 'access_list 正常；check-access-key 双分支拒绝逻辑实测正确'],
                ['mock 端到端', 'Azure/火山/百度/AWS中国区 4 家 SyncDispatcher.sync_all 入库成功'],
                ['前端类型', 'tsc --noEmit 无 CmpSettingsPage / api/cmp 错误'],
              ]}
              rowTone={['success', 'success', 'success', 'success', 'success']}
            />
            <Text tone="secondary" size="small">
              真实 API 调用需各厂商真实凭证；volcengine/baidubce/azure SDK 全部方法内懒加载，
              未安装不影响注册与系统运行，部署时按 requirements.txt 安装。
            </Text>
          </Stack>
        </ReportSection>

        <Divider />

        <ReportSection title="最终结果" description="Spec 全项完成，目标已标记 complete">
          <Table
            headers={['提交', '内容']}
            rows={[
              ['1b2eea7', '常量收敛（cloud_types.py）+ DNS 补全（阿里/腾讯 records + AWS 字段修复）'],
              ['f2ea9c1', '4 家新 Client + CloudAccess 认证模型 + check-access-key 分支 + migration 0004'],
              ['71a68a5', '前端表单 8 家下拉 + auth_type 派生 + Azure 条件字段'],
            ]}
          />
        </ReportSection>

        <Text tone="secondary" size="small">
          完成报告 · Qoder Quest · 2026-08-17
        </Text>
      </Stack>
    </ReportShell>
  );
}
