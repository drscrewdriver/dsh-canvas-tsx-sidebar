import {
  Callout,
  H1,
  MetricsGrid,
  ReportSection,
  ReportShell,
  Stack,
  Table,
  Text,
} from 'qoder/canvas';

export default function DreamerThreeQuestionsReport() {
  return (
    <ReportShell width="wide" ariaLabel="Dreamer 三问调研完成报告">
      <Stack gap="section">
        <header>
          <Stack gap="component">
            <H1>Dreamer 三问调研完成报告</H1>
            <Text tone="secondary">
              计划：Dreamer三问调研计划 · 产出 3 份 markdown 文档 · 2026-08-13
            </Text>
            <MetricsGrid
              variant="header"
              columns={4}
              items={[
                { label: '交付文档', value: '3', unit: '份' },
                { label: '代码文件精读', value: '12+', unit: '个' },
                { label: '论文笔记精读', value: '3', unit: '篇' },
                { label: '计划项核对', value: '8/8', unit: '通过' },
              ]}
            />
          </Stack>
        </header>

        <ReportSection
          title="成果总结"
          description="三个问题均有对应文档，结论如下"
          divided
        >
          <Table
            headers={['问题', '文档', '核心结论']}
            rows={[
              [
                '1. torch 移植 vs JAX 官方',
                'DreamerV3_Torch移植_vs_JAX官方_实现对照.md',
                '算法骨架一一对应；最大差异为 actor 更新（官方 REINFORCE vs 移植默认穿模型价值梯度）、优化器（AGC+RMSProp vs Adam）、官方独有 replay_context/repval_loss/contdisc',
              ],
              [
                '2. V1→V2→V3 演进',
                'Dreamer_V1_V2_V3_演进综述.md',
                '主线：表示升级（高斯→离散）→ 优化升级（价值梯度→REINFORCE）→ 数值鲁棒性（symlog/归一化/慢目标）→ 通用性（固定超参跨域）',
              ],
              [
                '3. v10 训不出原因',
                'dreamer_v1_pendulum_v10_训不出原因_静态审查.md',
                '无致命代码 bug（历史 bug 均已修复、与官方逐模块一致、梯度路径完整）；根因是官方基准设定（1:1 训练/长回合/[0,1] 奖励）与自定义设定（1:2/-10 级多分量奖励/200 步回合）的组合错配',
              ],
            ]}
          />
        </ReportSection>

        <ReportSection
          title="关键步骤"
          description="调研 → 代码精读 → 撰写 → 审计修正"
          divided
        >
          <Table
            headers={['#', '步骤', '对象', '状态']}
            rows={[
              ['1', '精读三篇论文笔记', 'DREAMER V1/V2/V3 markdown（约 230KB）', '完成'],
              ['2', '细读官方 V1 代码', 'dreamer_v1_official/dreamer.py（464 行）+ models.py（177 行）', '完成'],
              ['3', '细读 torch 移植代码', 'dreamerv3-torch：dreamer.py / models.py / networks.py / tools.py / exploration.py', '完成'],
              ['4', '细读 JAX 官方代码', 'dreamer_v3_official：agent.py / rssm.py / configs.yaml / embodied/jax（opt/heads/outs）', '完成'],
              ['5', '撰写三份 markdown 文档', '按计划大纲逐节撰写', '完成'],
              ['6', '完成审计与修正', '核对计划全部要求；修正文档 1 的 3.10 编号为 4.1；基于官方代码证据修正两处计划假设', '完成'],
            ]}
          />
        </ReportSection>

        <ReportSection
          title="变更文件"
          description="仅新增 3 份文档 + 1 份报告，未修改任何代码"
          divided
        >
          <Table
            headers={['文件', '大小', '内容']}
            rows={[
              [
                'markdown/DreamerV3_Torch移植_vs_JAX官方_实现对照.md',
                '15.6 KB',
                '总览 / 文件-模块一一对应表 / 9 项算法差异 / 16 项超参对照 / 结论',
              ],
              [
                'markdown/Dreamer_V1_V2_V3_演进综述.md',
                '11.7 KB',
                '三版本架构对比表 / V1→V2 与 V2→V3 改进 / 代码级佐证 / 机理总结 / 启示',
              ],
              [
                'markdown/dreamer_v1_pendulum_v10_训不出原因_静态审查.md',
                '14.1 KB',
                '历史 bug 表 / 15 项忠实度核对 / 风险分级发现 / 梯度路径推演 / 修复建议 / 结论',
              ],
              [
                'canvases/dreamer-three-questions-report.canvas.tsx',
                '本报告',
                '完成报告可视化',
              ],
            ]}
          />
        </ReportSection>

        <ReportSection
          title="验证证据"
          description="文件级证据，非推断"
          divided
        >
          <Table
            headers={['验证项', '方法', '结果']}
            rows={[
              ['三份文档存在', 'Get-ChildItem 检查大小', '15.6KB / 11.7KB / 14.1KB，均存在'],
              ['文档结构完整', 'Grep 章节标题', '文档1：15 个标题；文档2：15 个标题；文档3：10 个标题，计划要求的章节全部齐备'],
              ['编号修正', 'SearchReplace', '3.10 train_ratio 移至 §4 内改为 4.1，交叉引用同步更新'],
              ['计划存疑项修正', '官方代码对照', 'λ-return reward[:-1] 与 actor 输入 stop_gradient 经官方代码验证一致，文档如实标注为非问题'],
              ['执行约束', '过程记录', '未运行训练/诊断脚本、未修改任何代码文件，符合计划"不做的事"'],
            ]}
          />
          <Callout tone="success">
            计划文件全部 8 项要求（3 份文档位置与内容大纲、执行步骤 1-5、不做的事、假设）均已满足并有证据。
          </Callout>
        </ReportSection>

        <ReportSection title="最终结论" divided>
          <Stack gap="component">
            <Callout tone="info">
              <Text weight="semibold">问题 1</Text>：两个 V3 实现算法骨架一一对应，差异集中在 actor 梯度估计器（最大）、优化器与官方三个独有稳定性特性；移植版复现官方需 --imag_gradient reinforce 并接受优化器无法对齐。
            </Callout>
            <Callout tone="info">
              <Text weight="semibold">问题 2</Text>：V1→V2→V3 演进主线为表示→优化→数值鲁棒性→通用性四步升级，每一步都有论文消融与官方代码佐证；V3 更稳的机理在于 REINFORCE 断梯度、symlog/twohot 解耦尺度、分位数归一化、慢目标与 free bits。
            </Callout>
            <Callout tone="warning">
              <Text weight="semibold">问题 3</Text>：v10 无致命代码 bug；训不出源于"V1 价值梯度法 × 自定义复杂奖励 × 短回合 × 欠训"的组合错配，补偿性工程（专家注入/LQR-BC）掩盖了基础链路失效；出路为对齐官方基准或迁移 V3 系实现。
            </Callout>
          </Stack>
        </ReportSection>
      </Stack>
    </ReportShell>
  );
}
