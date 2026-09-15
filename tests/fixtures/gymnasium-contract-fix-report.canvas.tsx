import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  Stack,
  Stat,
  Table,
  Tag,
  Text,
  Timeline,
} from 'qoder/canvas';

export default function GymnasiumContractFixReport() {
  return (
    <Stack gap={20}>
      <H1>Gymnasium 契约对齐终局修复 · 完成报告</H1>
      <Text tone="secondary">
        7 个 dreamerv3-torch -no-gym 副本在 gymnasium 1.3.0 下彻底摆脱旧版 gym，
        wrapper 栈契约一次性对齐，5 层递进验证全部通过。
      </Text>

      <Grid columns={4} gap={16}>
        <Stat value="7/7" label="副本迁移完成" tone="success" />
        <Stat value="2 类" label="实际改动文件（wrappers.py×7 + 基座 dreamer.py）" />
        <Stat value="5/5" label="验证层级通过" tone="success" />
        <Stat value="3 条" label="观测路径冒烟覆盖（proprio / pixel / no-image）" />
      </Grid>

      <Divider />

      <H2>成果总结</H2>
      <Callout tone="success" title="终局状态">
        wrapper 栈的 reset/step 契约曾自相矛盾（2 元组解包 / 单值返回 / gymnasium
        默认转发混用），导致"修一层冒一层"。本次按"边界分层契约"一次性穷举修复全部
        不匹配点：TimeLimit 以内保持 gymnasium 合规，TimeLimit 为唯一 5→4 转换边界，
        TimeLimit 以上对齐 simulate 遗留契约；所有 wrapper 显式实现标准 reset 签名并向内
        转发 seed/options，结构性消除 gym.Wrapper.reset 默认转发的历史 TypeError 根源。
      </Callout>

      <H2>关键步骤</H2>
      <Timeline
        events={[
          {
            id: 'plan',
            timestamp: '步骤 1',
            state: 'completed',
            title: 'UltraPlan 三视角规划',
            description:
              '简洁性 / 正确性验证 / 最小改动三个独立方案并行探索，核对 gymnasium 1.3.0 core.py 契约，穷举 wrapper 栈全部不匹配点（M1-M10）后综合定稿。',
          },
          {
            id: 'rewrite',
            timestamp: '步骤 2',
            state: 'completed',
            title: 'canonical wrappers.py 重写',
            description:
              '5 处修改 + 契约注释块：TimeLimit/OneHotAction/RewardObs/SelectAction/UUID 的 reset 显式签名，RewardObs.step 4 元组解包，OneHotAction.reset 保持 2 元组。',
          },
          {
            id: 'distribute',
            timestamp: '步骤 3',
            state: 'completed',
            title: '字节分发 + 基座修复',
            description:
              'shutil.copyfile 分发到其余 6 副本（MD5 复核单值）；基座 dreamer.py MUJOCO_GL 改 glfw/osmesa 分支；清理 14 个 __pycache__。',
          },
          {
            id: 'verify',
            timestamp: '步骤 4',
            state: 'completed',
            title: '5 层递进验证',
            description:
              'L1 静态 → L2 import → L3 真实环境链路 → L4 tools.simulate 写盘 → L5 短训练冒烟，任一层失败只在本层定位。',
          },
          {
            id: 'memory',
            timestamp: '步骤 5',
            state: 'completed',
            title: '记忆修正收尾',
            description:
              '更正"全部通过验证"的不实任务总结（补记当时冒烟实际失败与终局修复），三连坑经验更新为边界分层契约终局模式。',
          },
        ]}
      />

      <H2>变更文件</H2>
      <Table
        headers={['文件', '改动', '范围']}
        rows={[
          [
            'dreamerv3-torch-*/envs/wrappers.py',
            '边界分层契约重写：5 处 reset 显式签名 + seed 转发、RewardObs.step 4 元组、OneHotAction.reset 2 元组、契约注释块',
            '7 副本 MD5 一致（51f4fa57）',
          ],
          [
            'dreamerv3-torch-no-gym/dreamer.py',
            'MUJOCO_GL 硬编码 osmesa → "glfw" if os.name == "nt" else "osmesa"',
            '基座 1 行',
          ],
          [
            '各副本 __pycache__',
            '清理 14 个目录，防陈旧字节码掩盖修改',
            '7 副本',
          ],
        ]}
      />
      <Text tone="secondary" size="small">
        明确不动：envs/dmc.py、envs/atari.py、tools.py、parallel.py、models.py、networks.py；
        可选环境模块（dmlab/minecraft/memorymaze）仅标注不修；v1 家族旧 gym suite 不恢复（与摆脱旧版 gym 目标一致）。
      </Text>

      <H2>验证证据</H2>
      <Table
        headers={['层级', '范围', '证据', '结果']}
        rows={[
          ['L1 静态', '7 副本全量', 'py_compile + UTF-8 strict + MD5 单值 + 核心文件无 import gym 残留', 'PASS'],
          ['L2 import', '7 副本', 'envs.wrappers / envs.dmc / tools / parallel 全部导入成功', 'PASS'],
          [
            'L3 真实环境链路',
            '7 副本',
            '真实 DeepMindControl 组装完整 wrapper 链：reset 返回 dict（含 image/is_first/is_terminal）、step 4 元组、显式 seed 转发、时限到期 done+discount、re-reset',
            'PASS',
          ],
          ['L4 simulate', 'dm + no-image 2 副本', 'make_env → Damy → tools.simulate 10 步，episode npz 写盘且含 image 键', 'PASS'],
          [
            'L5 短训练冒烟',
            '3 副本 × 3 路径',
            'dm proprio/MLP、v1 pixel/CNN、no-image MLP 均完成 环境创建→prefill→eval→训练迭代→checkpoint，退出码 0；产物复核 latest.pt=True、train_npz=1、eval_npz=10',
            'PASS',
          ],
        ]}
        rowTone={['success', 'success', 'success', 'success', 'success']}
      />
      <Text tone="secondary" size="small">
        残留警告均无害：gymnasium Box 精度 UserWarning、torch amp FutureWarning、moviepy.editor 缺失（仅影响视频日志）。
      </Text>

      <H2>执行纪律落实</H2>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="UTF-8 写入安全" />
          <CardBody>
            <Text size="small">
              全部写入仅用 SearchReplace/Write 工具与 .venv Python utf-8 读写，
              未使用任何 PowerShell Set-Content/Out-File；写后 py_compile + strict 解码双重校验。
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="幂等与锚点断言" />
          <CardBody>
            <Text size="small">
              每处替换使用唯一锚点，匹配失败即报错不盲写；wrappers.py 7 副本字节一致，
              单点编辑后二进制分发并 MD5 复核。
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <Divider />
      <Stack gap={8}>
        <H2>最终结论</H2>
        <Text>
          计划全部交付物已落地并经当前文件系统复核：7 个 -no-gym 副本在 gymnasium 1.3.0
          下训练链路（env 创建 → reset → step → tools.simulate → Dreamer 训练与 checkpoint）
          完整可用，旧版 gym 依赖彻底清除。此前"反复冒烟反复失败"的问题由边界分层契约 +
          分层验证机制终结。
        </Text>
        <Tag tone="success">AUDIT: ALL PASS · 目标已完成</Tag>
      </Stack>
    </Stack>
  );
}
