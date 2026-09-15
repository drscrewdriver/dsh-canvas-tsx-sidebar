import {
  Stack,
  Grid,
  H1,
  H2,
  Text,
  Divider,
  Stat,
  Table,
  Tag,
  Callout,
  Row,
} from 'qoder/canvas';

export default function ReactMigrationReport() {

  const techStack = [
    ['Vite 8', '构建工具', '217ms 构建'],
    ['React 18', 'UI 框架', '组件化架构'],
    ['TypeScript', '类型系统', '0 编译错误'],
    ['Tailwind CSS 4', '样式方案', '26.39 KB gzip'],
    ['Zustand', '状态管理', '轻量全局状态'],
  ];

  const chapters = [
    ['Ch1 角色选择', 'Fire Mage / Steel Paladin 双角色 + 表情预览', '完成'],
    ['Ch2 精力评估', '智能手表数据输入 + JS 公式计算三维度', '完成'],
    ['Ch3 目标分解', 'Mock API 进度动画 + 只读启发性计划', '完成'],
    ['Ch4 任务执行', '体力/精力消耗 + 角色表情实时联动', '完成'],
    ['Ch5 今日总结', '动态任务回顾 + SVG 雷达图 + 成就墙 + 鼓励文案', '完成'],
    ['Ch6 第二天', '任务顺延机制 + Day 2 场景', '完成'],
  ];

  const buildOutput = [
    ['index.html', '0.81 KB', '0.37 KB'],
    ['CSS bundle', '26.39 KB', '5.94 KB'],
    ['JS bundle', '227.12 KB', '70.04 KB'],
    ['角色资产', '84 文件', '—'],
  ];

  return (
    <Stack gap={20}>
      <H1>GameLife Story Demo — 框架迁移报告</H1>
      <Text tone="secondary">
        将 974 行单文件 HTML 迁移为 Vite + React + TypeScript + Tailwind 可构建项目，同时完成 5 项功能改进。
      </Text>

      <Divider />

      <H2>关键指标</H2>
      <Grid columns={4} gap={16}>
        <Stat value="6" label="章节组件" />
        <Stat value="3" label="通用组件" />
        <Stat value="84" label="资产文件" />
        <Stat value="0" label="构建错误" tone="success" />
      </Grid>

      <Divider />

      <H2>技术栈</H2>
      <Table
        headers={['技术', '用途', '备注']}
        rows={techStack}
      />

      <Divider />

      <H2>章节迁移清单</H2>
      <Table
        headers={['章节', '功能要点', '状态']}
        rows={chapters}
        rowTone={chapters.map(() => 'success' as const)}
      />

      <Divider />

      <H2>构建产物</H2>
      <Table
        headers={['文件', '原始大小', 'Gzip']}
        rows={buildOutput}
      />

      <Divider />

      <H2>5 项功能改进</H2>
      <Stack gap={12}>
        <Row gap={8}>
          <Tag tone="success">已实现</Tag>
          <Text>UI 西幻风格 — 日夜主题切换 (CSS Variables) + Cinzel/Noto Sans SC 字体 + 羊皮纸/魔法卡片</Text>
        </Row>
        <Row gap={8}>
          <Tag tone="success">已实现</Tag>
          <Text>章节5 动态总结 — 从 store.completedTasks 读取 + 完成率/体力驱动鼓励文案</Text>
        </Row>
        <Row gap={8}>
          <Tag tone="success">已实现</Tag>
          <Text>人物面板 — SVG 五维雷达图 + 成就徽章墙 (8 枚)</Text>
        </Row>
        <Row gap={8}>
          <Tag tone="success">已实现</Tag>
          <Text>启发性计划 — Ch3 任务分解改为只读展示 + "自我提升计划参考" 标签</Text>
        </Row>
        <Row gap={8}>
          <Tag tone="success">已实现</Tag>
          <Text>章节6 顺延 — 未完成任务自动带入 Day 2 + 顺延机制说明</Text>
        </Row>
      </Stack>

      <Divider />

      <H2>项目结构</H2>
      <Callout tone="info">
        <Text size="small">
          game-like-life/story-demo/ — 完整可构建项目，npm run build 输出 dist/，可直接部署或作为后续正式开发起点。
        </Text>
      </Callout>

      <Text tone="secondary" size="small">
        目标已完成 · 构建验证通过 · 开发服务器 http://localhost:5173
      </Text>
    </Stack>
  );
}
