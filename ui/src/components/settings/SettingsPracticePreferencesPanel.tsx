import { SelectField } from '../form';
import {
  SETTINGS_DIFFICULTY_OPTIONS,
  SETTINGS_SESSION_LENGTH_OPTIONS,
  SETTINGS_TIMER_OPTIONS,
  SETTINGS_TOPICS,
} from './settings.constants';
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
      <SelectField
        id="default-difficulty"
        label="Default Difficulty"
        placeholder="Select difficulty"
        options={SETTINGS_DIFFICULTY_OPTIONS}
        density="compact"
        value={values.defaultDifficulty}
        disabled={isSaving}
        onChange={(defaultDifficulty) => onChange({ ...values, defaultDifficulty })}
      />
      <SelectField
        id="session-length"
        label="Session Length"
        placeholder="Select session length"
        options={SETTINGS_SESSION_LENGTH_OPTIONS}
        density="compact"
        value={String(values.sessionLength)}
        disabled={isSaving}
        onChange={(sessionLength) => onChange({ ...values, sessionLength: Number(sessionLength) })}
      />
      <SelectField
        id="timer-per-question"
        label="Timer per Question"
        placeholder="Select timer"
        options={SETTINGS_TIMER_OPTIONS}
        density="compact"
        value={String(values.timerPerQuestion)}
        disabled={isSaving}
        onChange={(timerPerQuestion) =>
          onChange({ ...values, timerPerQuestion: Number(timerPerQuestion) })
        }
      />
      <div>
        <div className="mb-[0.35rem] text-[0.78rem] font-medium text-[var(--dim)]">
          Preferred Topics
        </div>
        <div className="flex flex-wrap gap-[0.4rem]">
          {SETTINGS_TOPICS.map((topic) => {
            const isSelected = values.preferredTopics.includes(topic);

            return (
              <button
                key={topic}
                type="button"
                aria-pressed={isSelected}
                disabled={isSaving || (isSelected && values.preferredTopics.length === 1)}
                onClick={() => toggleTopic(topic)}
                className={`rounded-full border px-[0.85rem] py-[0.4rem] text-[0.78rem] transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border2)] hover:text-[var(--text)]'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        <PreferenceToggle
          label="Show hints after skip"
          description="Display a hint when you skip a question"
          checked={values.showHintsOnSkip}
          disabled={isSaving}
          onChange={(showHintsOnSkip) => onChange({ ...values, showHintsOnSkip })}
        />
        <PreferenceToggle
          label="Auto-advance to next question"
          description="Move to next question 3 seconds after submitting"
          checked={values.autoAdvance}
          disabled={isSaving}
          onChange={(autoAdvance) => onChange({ ...values, autoAdvance })}
        />
      </div>
    </div>
  );
};

const PreferenceToggle = (props: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex min-h-[4.5rem] items-center justify-between gap-4 py-3">
    <div>
      <h3 className="text-sm font-medium text-[var(--text-h)]">{props.label}</h3>
      <p className="mt-1 text-xs text-[var(--dim)]">{props.description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-label={props.label}
      aria-checked={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      className={`relative h-5 w-10 shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ${
        props.checked
          ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]'
          : 'border-[var(--border2)] bg-[var(--surface)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[2px] size-3.5 rounded-full transition-[left,background-color] ${
          props.checked ? 'left-[21px] bg-[var(--accent-strong)]' : 'left-[2px] bg-[var(--dim)]'
        }`}
      />
    </button>
  </div>
);
