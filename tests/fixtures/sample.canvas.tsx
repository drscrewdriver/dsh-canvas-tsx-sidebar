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
} from 'qoder/canvas';

export default function CmpCloudSdkReport() {
  return (
    <ReportShell width="wide" ariaLabel="CMP 云厂商 SDK 补全完成报告">
      <Stack gap="section">
        <header>
          <Stack gap="component">
            <H1>CMP 云厂商 SDK 补全 — 完成报告</H1>
            <Text tone="secondary">
              Spec: CMP 云厂商 SDK 补全 · 2026-08-15 · 分支 feature/cmp-cloud-sdk · 提交 9dce20e
            </Text>
            <Grid columns={4} gap={16}>
              <Stat value="2" label="新增云厂商" />
              <Stat value="32" label="扫描方法" />
              <Stat value="9" label="变更文件" />
              <Stat value="+1247" label="新增代码行" />
            </Grid>
          </Stack>
        </header>

        <Divider />

        <ReportSection
          title="关键成果"
          description="AWS 与华为云 Client 从零到全量实现，并打通注册与同步链路"
        >
          <Stack gap="component">
            <Callout tone="info" title="注册链路修复">
              clients/__init__.py 此前未导入任何厂商子包，register_client 装饰器从未执行，
              注册表实际为空（连阿里云/腾讯云都无法通过 get_client 获取）。已补充 4 家子包导入。
            </Callout>
            <Callout tone="warning" title="sync_all 计数 bug 修复">
              sync.py 全量同步中 int 与 dict 相加（0 + {'created': ...}）导致 TypeError，
              该路径此前从未跑通。新增 _merge_count 统一累加计数。
            </Callout>
          </Stack>
        </ReportSection>

        <Divider />

        <ReportSection title="新增 Client 实现" description="16 个方法覆盖计算/网络/数据库/域名/财务">
          <Grid columns={2} gap={16}>
            <Stack gap="component">
              <H2>AWS Client（clients/aws/client.py，524 行）</H2>
              <Table
                headers={['资源域', 'boto3 服务', '方法']}
                rows={[
                  ['区域/可用区', 'ec2', 'scan_regions / scan_zones'],
                  ['计算', 'ec2', 'hosts / disks / images / snapshots'],
                  ['网络', 'ec2 + elb/elbv2', 'vpcs / security_groups / eips / load_balancers'],
                  ['数据库', 'rds / elasticache / docdb', 'scan_rds / scan_redis / scan_mongo'],
                  ['域名', 'route53', 'scan_domains / scan_domain_records'],
                  ['财务', 'ce', 'get_balance'],
                ]}
              />
              <Text tone="secondary" size="small">
                分页：NextToken / Marker 双模式；字段映射 InstanceId 到 inst_id、State.Name 到 status
              </Text>
            </Stack>
            <Stack gap="component">
              <H2>华为云 Client（clients/huawei/client.py，663 行）</H2>
              <Table
                headers={['资源域', 'SDK 包', '方法']}
                rows={[
                  ['区域/可用区', 'huaweicloudsdkecs', 'scan_regions / scan_zones'],
                  ['计算', 'ecs + evs', 'hosts / disks / images / snapshots'],
                  ['网络', 'vpc + elb', 'vpcs / security_groups / eips / load_balancers'],
                  ['数据库', 'rds / dcs / dds', 'scan_rds / scan_redis / scan_mongo'],
                  ['域名', '（首批暂空）', 'scan_domains / scan_domain_records'],
                  ['财务', '（可选）', 'get_balance'],
                ]}
              />
              <Text tone="secondary" size="small">
                分页：marker + offset；状态映射 ACTIVE 到 Running、SHUTOFF 到 Stopped
              </Text>
            </Stack>
          </Grid>
        </ReportSection>

        <Divider />

        <ReportSection title="注册与打通" description="四层联动，双前端可选">
          <Table
            headers={['层', '文件', '变更']}
            rows={[
              ['注册表', 'clients/registry.py', "get_supported_cloud_types 补充 '3'=AWS、'4'=华为云"],
              ['包导入', 'clients/__init__.py', '导入 aliyun/tencent/aws/huawei 子包触发装饰器'],
              ['依赖', 'requirements.txt', 'boto3 + 7 个 huaweicloudsdk 包（core/ecs/vpc/rds/dcs/dds/elb）'],
              ['前端', 'CmpSettingsPage.tsx', '云厂商下拉补充 AWS(3)、华为云(4)'],
            ]}
          />
        </ReportSection>

        <Divider />

        <ReportSection title="验证证据" description="当前工作区实测结果">
          <Stack gap="component">
            <Table
              headers={['验证项', '结果']}
              rows={[
                ['注册表完整性', "registry keys = ['1','2','3','4']，supported 含 ('3','AWS')、('4','华为云')"],
                ['抽象方法实现', '4 家 Client abstract_left 均为空（13 个抽象方法全部实现）'],
                ['端到端同步', 'mock SyncDispatcher.sync_all 写入数据库成功（regions/zones/vpcs/hosts 各 1 条）'],
                ['Django check', '通过，仅预存的 cmp namespace 警告'],
                ['前端类型', 'tsc --noEmit 无 CmpSettingsPage 错误'],
              ]}
              rowTone={['success', 'success', 'success', 'warning', 'success']}
            />
            <Text tone="secondary" size="small">
              环境依赖：本地已安装 boto3 1.43.72 与 huaweicloudsdkcore；其余 SDK 包按 requirements.txt 部署安装。
              真实 API 调用需真实云 AK/SK，本环境未做线上验证。
            </Text>
          </Stack>
        </ReportSection>

        <Divider />

        <ReportSection title="路线图标注" description="Phase 2-4 仅标记，不在本次范围">
          <Table
            headers={['阶段', '范围', '状态']}
            rows={[
              ['Phase 2', 'Azure(5)、vCenter(6)：认证模型不同（订阅ID+租户ID / 用户名密码）', '待排期'],
              ['Phase 3', 'OpsAny 14 家公有云剩余：Azure中国区/AWS中国区/火山引擎/金山云/百度云/七牛云/浪潮云/天翼云', '待排期'],
              ['Phase 4', 'OpsAny 9 家私有云：OpenStack/Proxmox/ZStack/SmartX/ManageOne/XVP/金豆云/云通', '待排期'],
            ]}
          />
        </ReportSection>

        <Text tone="secondary" size="small">
          完成报告 · Qoder Quest · 2026-08-15
        </Text>
      </Stack>
    </ReportShell>
  );
}
