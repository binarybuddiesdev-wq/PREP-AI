import { ONBOARDING_TOPICS } from '@/core';
import { SelectField } from '../form';
import { SETTINGS_DIFFICULTY_OPTIONS } from './settings.constants';
import type { ISettingsPracticePreferencesPanelProps } from './SettingsPracticePreferencesPanel.types';

export const SettingsPracticePreferencesPanel = (props: ISettingsPracticePreferencesPanelProps) => {
  const { values, isSaving, onChange } = props;

  const toggleTopic = (topic: string) => {
    const isSelected = values.preferredTopics.includes(topic);
    if (isSelected && values.preferredTopics.length === 1) return;

    const preferredTopics = isSelected
      ? values.preferredTopics.filter((selectedTopic) => selectedTopic !== topic)
      : [...values.preferredTopics, topic];
    onChange({ ...values, preferredTopics });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">Focus topics</h3>
        <p className="mt-1 text-xs text-zinc-500">Choose the topics you want to practice.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ONBOARDING_TOPICS.map((topic) => {
            const isSelected = values.preferredTopics.includes(topic);

            return (
              <button
                key={topic}
                type="button"
                aria-pressed={isSelected}
                disabled={isSaving || (isSelected && values.preferredTopics.length === 1)}
                onClick={() => toggleTopic(topic)}
                className={`min-h-7 rounded-full border px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-100'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
      </div>
      <div className="max-w-xs">
        <SelectField
          id="default-difficulty"
          label="Default difficulty"
          placeholder="Select difficulty"
          options={SETTINGS_DIFFICULTY_OPTIONS}
          density="compact"
          value={values.defaultDifficulty}
          disabled={isSaving}
          onChange={(defaultDifficulty) => onChange({ ...values, defaultDifficulty })}
        />
      </div>
    </div>
  );
};
