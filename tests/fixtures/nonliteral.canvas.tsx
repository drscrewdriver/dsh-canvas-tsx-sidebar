import { H1, Text, Stack, Callout, Table } from 'qoder/canvas';

const rows = [['a', 'b']];

export default function NonLiteralCanvas({ someVar }: { someVar: string }) {
  return (
    <Stack gap={gapVar}>
      <H1>{title}</H1>
      <Text tone={theme}>{someVar}</Text>
      <Callout tone="info" title="map 子节点">
        {rows.map(([k, v]) => `${k}=${v}`)}
      </Callout>
      <Table headers={['k', 'v']} rows={rows} />
      <Text>{`template ${someVar}`}</Text>
      <Text>{'plain literal'}</Text>
    </Stack>
  );
}
