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

export default function PendulumV1RestoreReport() {
  return (
    <Stack gap={20}>
      <H1>恢复 Pendulum-v1 环境支持 · 完成报告</H1>
      <Text tone="secondary">
        4 个 v1 家族 -no-gym 副本在 gymnasium 1.3.0 下恢复 Pendulum-v1 环境支持：
        用户质疑"升级 gym 为何换成 dmc"成立——迁移时 Pendulum-v1 支持被整体丢弃，
        本次按 Spec 恢复 gym.py / pendulum_v1 配置块 / make_env gym 分支并完成 5 层验证。
      </Text>

      <Grid columns={4} gap={16}>
        <Stat value="4/4" label="副本恢复完成" tone="success" />
        <Stat value="3 处" label="每副本改动（gym.py + configs + dreamer.py）" />
        <Stat value="5/5" label="验证层级通过" tone="success" />
        <Stat value="7 个" label="评估脚本就位（只多不少）" />
      </Grid>

      <Divider />

      <H2>成果总结</H2>
      <Callout tone="success" title="问题根源与终局状态">
        对比 8 个副本发现：4 个原始副本（v1 / v1-reinforce / v1_no-image /
        v1_no-image-reinforce）全部有 envs/gym.py + pendulum_v1 配置块 + make_env
        gym 分支，而 4 个 -no-gym 副本全部丢失——"pendulum-v1" 后缀名不副实。
        本次将原始 GymPendulum 封装迁移到 gymnasium 契约（继承 gym.Env、reset 2 元组、
        step 5 元组、disable_env_checker），按像素版（CNN 渲染）/ proprio 版（全零占位）
        两类分别恢复，并验证 4 副本训练链路完整可用。
      </Callout>

      <H2>关键步骤</H2>
      <Timeline
        events={[
          {
            id: 'audit',
            timestamp: '步骤 1',
            state: 'completed',
            title: '副本差异审计',
            description:
              '对比 8 个副本：4 个原始副本均有 gym.py / pendulum_v1 配置块 / suite=="gym" 分支，4 个 -no-gym 副本全部缺失；确认"pendulum-v1 后缀在做什么"的质疑成立。',
          },
          {
            id: 'gympy',
            timestamp: '步骤 2',
            state: 'completed',
            title: 'gymnasium 版 envs/gym.py',
            description:
              '像素版（zoom 1.5 + 高斯抗锯齿渲染管线）与 proprio 版（state 3 维 + 全零 image 占位）两类 GymPendulum，均继承 gymnasium.Env、reset 2 元组、step 5 元组、disable_env_checker=True。',
          },
          {
            id: 'config',
            timestamp: '步骤 3',
            state: 'completed',
            title: '恢复 pendulum_v1 配置块',
            description:
              '4 副本 configs.yaml 插入 pendulum_v1 块：task=gym_Pendulum-v1、action_repeat=1、entropy=0.01；像素版 cnn_keys=image，proprio 版 mlp_keys=.*。',
          },
          {
            id: 'makeenv',
            timestamp: '步骤 4',
            state: 'completed',
            title: '恢复 make_env gym 分支',
            description:
              '4 副本 dreamer.py 在 minecraft 分支前恢复 suite=="gym" 分支：GymPendulum → NormalizeActions → TimeLimit → SelectAction → UUID。',
          },
          {
            id: 'verify',
            timestamp: '步骤 5',
            state: 'completed',
            title: '5 层递进验证',
            description:
              'L1 静态（py_compile + UTF-8 + 无旧 gym import）→ L2 import → L3 环境链路（reset/step 契约断言）→ L4 短训练冒烟（4 副本各 60 步）→ 产物清理，全部 PASS。',
          },
          {
            id: 'eval',
            timestamp: '步骤 6',
            state: 'completed',
            title: '评估脚本补齐（只多不少）',
            description:
              'v1-no-gym 补齐 _verify_obs_consistency / _compare_pipeline / _preview_pixel_obs（gymnasium 适配），修复 _render_ckpt（旧路径）与 _rollout_stats（硬编码 ckpt）；实测渲染 GIF 与统计均可用。',
          },
        ]}
      />

      <H2>变更文件</H2>
      <Table
        headers={['副本', 'envs/gym.py', 'configs.yaml', 'dreamer.py']}
        rows={[
          ['dreamerv3-torch-pendulum-v1-no-gym', '新增（像素版）', 'pendulum_v1 块', 'suite=="gym" 分支'],
          ['dreamerv3-torch-pendulum-v1-reinforce-no-gym', '新增（像素版）', 'pendulum_v1 块', 'suite=="gym" 分支'],
          ['dreamerv3-torch-pendulum-v1_no-image-no-gym', '新增（proprio 版）', 'pendulum_v1 块', 'suite=="gym" 分支'],
          ['dreamerv3-torch-pendulum-v1_no-image-reinforce-no-gym', '新增（proprio 版）', 'pendulum_v1 块', 'suite=="gym" 分支'],
        ]}
      />
      <Text tone="secondary" size="small">
        另在 v1-no-gym 补齐/修复 6 个评估脚本（_render_ckpt / _rollout_stats / _bench_res /
        _verify_obs_consistency / _compare_pipeline / _preview_pixel_obs），加上既有
        _eval_ckpt_viz 共 7 个评估工具。
      </Text>

      <Divider />

      <H2>验证证据</H2>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="L1-L3 静态与链路（4 副本全过）" />
          <CardBody>
            <Stack gap={10}>
              <Text size="small">
                py_compile + UTF-8 严格解码通过；gym.py 无旧 gym import（gymnasium 专属）；
                make_env 全链路 reset(seed=0) + step×10 断言 obs 键（state/image/is_first/
                is_terminal）、5→4 元组折叠、discount 存在，re-reset 正常。
              </Text>
              <Tag tone="success">ALL PASS</Tag>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="L4 短训练冒烟（4 副本各 60 步）" />
          <CardBody>
            <Stack gap={10}>
              <Text size="small">
                每副本产出 ckpt_*.pt / latest.pt / metrics.jsonl / train+eval npz；
                train metric（model_loss / image_loss / state_loss / reward_loss）完整打印；
                退出码 0。v1-no-gym 冒烟 checkpoint 按环境步命名（ckpt_60.pt）。
              </Text>
              <Tag tone="success">4/4 PASS</Tag>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="评估脚本实测" />
          <CardBody>
            <Stack gap={10}>
              <Text size="small">
                _render_ckpt 渲染 ckpt_60.pt 产出三面板 GIF（物理摆锤 + 64x64 观测 + θ/ω/τ
                曲线）；_verify_obs_consistency 50 步图像逐像素一致；_preview_pixel_obs
                10/10 帧非零；_rollout_stats 随机/底部各 5 次统计输出。
              </Text>
              <Tag tone="success">ALL PASS</Tag>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="最终完成审计" />
          <CardBody>
            <Stack gap={10}>
              <Text size="small">
                逐项核对 Spec：gym.py 契约（gymnasium/继承/2 元组/5 元组/渲染管线）、
                configs（pendulum_v1/task/action_repeat/entropy/keys）、dreamer.py 分支、
                评估脚本完整性、冒烟目录清理——57 项检查全部 PASS。
              </Text>
              <Tag tone="success">AUDIT: ALL PASS</Tag>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Divider />

      <H2>最终结论</H2>
      <Callout tone="success" title="目标完成">
        4 个 v1 家族 -no-gym 副本已在 gymnasium 1.3.0 下恢复 Pendulum-v1 环境支持，
        "pendulum-v1" 后缀重新名实相符。训练链路（prefill → eval → train → checkpoint）
        与评估工具链（GIF 渲染 / 一致性验证 / 统计）均验证可用；dm 家族副本不受影响，
        原始副本保留旧 gym 0.26.2 作为对照基线。启动命令：
        {' '}
        <Text size="small" tone="secondary">
          python dreamer.py --configs defaults pendulum_v1 --task gym_Pendulum-v1
          --logdir runs/pv1 --device cuda:0
        </Text>
      </Callout>
    </Stack>
  );
}
