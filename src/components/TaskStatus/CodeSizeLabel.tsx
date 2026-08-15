const units = ['', 'k', 'M', 'G'];

export const formatCodeSize = (size: number) => {
  let value = size;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${Math.round(value * 10) / 10}${units[unit]}`;
};

export default function CodeSizeLabel({
  size,
}: {
  size: number | null | undefined;
}) {
  if (size == null) return <>—</>;

  const exactSize = size.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return <span title={`${exactSize} chars`}>{formatCodeSize(size)}</span>;
}
