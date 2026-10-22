import type { IRawSettingsCardProps } from './RawSettingsCard.types';

export const RawSettingsCard = (props: IRawSettingsCardProps) => {
  const { settings } = props;

  return (
    <section className="bg-[#18181b] border border-white/10 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-zinc-400">Raw UserSettings JSON</h2>
      <pre className="text-xs text-zinc-400 bg-[#09090b] rounded-lg p-4 overflow-x-auto">
        {JSON.stringify(settings ?? null, null, 2)}
      </pre>
    </section>
  );
};
