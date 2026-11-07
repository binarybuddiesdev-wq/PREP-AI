interface ISettingsUsageMetricProps {
  label: string;
  value: string;
}

export const SettingsUsageMetric = (props: ISettingsUsageMetricProps) => {
  const { label, value } = props;
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs">
      <dt className="text-[var(--dim)]">{label}</dt>
      <dd className="font-semibold tabular-nums text-[var(--text)]">{value}</dd>
    </div>
  );
};
