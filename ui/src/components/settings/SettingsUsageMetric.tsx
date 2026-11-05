interface ISettingsUsageMetricProps {
  label: string;
  value: string;
}

export const SettingsUsageMetric = (props: ISettingsUsageMetricProps) => {
  const { label, value } = props;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-3">
      <dt className="text-[11px] font-medium text-[var(--dim)]">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--text-h)]">
        {value}
      </dd>
    </div>
  );
};
