import { H1, Text, Stack } from 'qoder/canvas';

// Precision-ceiling probe: none of these are modelled by the hand-rolled
// parser, and none may throw. Everything here must degrade to `unsupported`
// or be skipped, never crash.
export default function PrecisionCeiling<T extends string>() {
  return (
    <Stack gap="section">
      <H1>精度上限</H1>
      <Text>{value as string}</Text>
      <Text>{cond ? 'a' : 'b'}</Text>
      <Text>{obj.deep.field}</Text>
      <Text>{fn(arg)}</Text>
      <Text {...rest}>spread attribute</Text>
    </Stack>
  );
}
