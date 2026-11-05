interface ISettingsUsageMetricProps {
  label: string;
  value: string;
}

export const SettingsUsageMetric = (props: ISettingsUsageMetricProps) => {
  const { label, value } = props;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#141416] px-3 py-3">
      <dt className="text-[11px] font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-100">{value}</dd>
    </div>
  );
};
