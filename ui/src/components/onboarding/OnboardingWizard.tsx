import {
  ONBOARDING_DIFFICULTY_OPTIONS,
  ONBOARDING_EXPERIENCE_OPTIONS,
  ONBOARDING_ROLE_OPTIONS,
  ONBOARDING_TOPICS,
} from '@/core';
import { cn } from '@/utils';
import { SelectField } from '@/components/form';
import './OnboardingWizard.css';
import type { IOnboardingWizardProps } from './OnboardingWizard.types';

const STEPS = [
  { value: 1, label: 'Role and experience' },
  { value: 2, label: 'Target companies' },
  { value: 3, label: 'Topics and difficulty' },
] as const;

const fieldClassName =
  'mt-1.5 w-full rounded-lg border border-[var(--border2)] bg-[var(--bg2)] px-4 py-2 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--dim)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-bg)]';
const primaryButtonClassName =
  'inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-amber-950 whitespace-nowrap transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60';

const secondaryButtonClassName =
  'inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium text-[var(--text)] whitespace-nowrap transition hover:border-[var(--border2)] hover:bg-[var(--surface2)] hover:text-[var(--text-h)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60';

export const OnboardingWizard = (props: IOnboardingWizardProps) => {
  const {
    brand,
    step,
    values,
    isSaving,
    errorMessage,
    errorDetails,
    onChange,
    onContinue,
    onBack,
    onSkip,
    onFinish,
  } = props;

  const toggleTopic = (topic: (typeof ONBOARDING_TOPICS)[number]) => {
    const preferredTopics = values.preferredTopics.includes(topic)
      ? values.preferredTopics.filter((selectedTopic) => selectedTopic !== topic)
      : [...values.preferredTopics, topic];

    onChange({ ...values, preferredTopics });
  };

  return (
    <main
      aria-label="Profile setup"
      className="onboarding-screen fixed inset-0 isolate flex h-dvh min-h-0 w-full items-center justify-center overflow-y-auto bg-[var(--bg)] px-0 py-0 font-['DM_Sans',sans-serif] text-[var(--text)] sm:px-4 sm:py-2"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.06),transparent_70%)]"
      />
      <section
        aria-labelledby="onboarding-title"
        className="onboarding-card onboarding-card--viewport-fit relative w-full min-w-0 max-w-[520px] shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
      >
        <header className="onboarding-header mb-3 text-center">
          <div className="mb-1 flex justify-center">{brand}</div>
          <h1
            id="onboarding-title"
            className="m-0 text-[1.3rem] font-semibold leading-tight tracking-tight text-[var(--text-h)]"
          >
            Let’s set up your profile
          </h1>
          <p className="mt-1 text-sm text-[var(--dim)]">
            This helps us personalize your interview prep experience.
          </p>
        </header>

        <ol
          aria-label="Setup progress"
          className="onboarding-progress mb-8 flex items-center gap-2 px-1 sm:gap-3"
        >
          {STEPS.map((currentStep) => (
            <li
              key={currentStep.value}
              aria-current={step === currentStep.value ? 'step' : undefined}
              aria-label={`Step ${currentStep.value}: ${currentStep.label}${step > currentStep.value ? ', complete' : ''}`}
              className="flex min-w-0 flex-1 items-center last:flex-none"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                  step === currentStep.value &&
                    'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]',
                  step > currentStep.value && 'border-[var(--green)] bg-[var(--green)] text-white',
                  step < currentStep.value &&
                    'border-[var(--border2)] bg-[var(--bg)] text-[var(--dim)]'
                )}
              >
                {currentStep.value}
              </span>
              {currentStep.value < STEPS.length && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'ml-2 h-0.5 min-w-3 flex-1 rounded-full transition-colors sm:ml-3',
                    step > currentStep.value ? 'bg-[var(--green)]' : 'bg-[var(--border2)]'
                  )}
                />
              )}
            </li>
          ))}
        </ol>

        <div aria-live="polite">
          {step === 1 && (
            <section aria-labelledby="onboarding-step-title">
              <h2
                id="onboarding-step-title"
                className="m-0 text-[1.05rem] font-semibold text-[var(--text-h)]"
              >
                Tell us about your target role
              </h2>
              <p className="mt-1 text-sm text-[var(--dim)]">
                We&apos;ll tailor questions to match your interview goals.
              </p>

              <div className="onboarding-fields mt-3 space-y-2">
                <SelectField
                  id="onboarding-target-role"
                  label="Target Role"
                  placeholder="Select your target role"
                  options={ONBOARDING_ROLE_OPTIONS}
                  value={values.targetRole}
                  disabled={isSaving}
                  onChange={(targetRole) =>
                    onChange({ ...values, targetRole: targetRole as typeof values.targetRole })
                  }
                />
                <SelectField
                  id="onboarding-experience-level"
                  label="Experience Level"
                  placeholder="Select your experience level"
                  options={ONBOARDING_EXPERIENCE_OPTIONS}
                  value={values.experienceLevel}
                  disabled={isSaving}
                  onChange={(experienceLevel) =>
                    onChange({
                      ...values,
                      experienceLevel: experienceLevel as typeof values.experienceLevel,
                    })
                  }
                />
              </div>

              <div className="onboarding-actions mt-4 flex gap-3">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={isSaving}
                  onClick={onContinue}
                >
                  {isSaving ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="onboarding-step-title">
              <h2
                id="onboarding-step-title"
                className="m-0 text-[1.05rem] font-semibold text-[var(--text-h)]"
              >
                Where are you applying?
              </h2>
              <p className="mt-1 text-sm text-[var(--dim)]">
                Optional &mdash; we&apos;ll bias questions toward what those companies ask.
              </p>

              <div className="onboarding-content-section mt-3">
                <label
                  htmlFor="onboarding-target-companies"
                  className="text-[0.8rem] font-medium text-[var(--text)]"
                >
                  Target Companies <span className="font-normal text-[var(--dim)]">(optional)</span>
                </label>
                <input
                  id="onboarding-target-companies"
                  className={fieldClassName}
                  disabled={isSaving}
                  placeholder="e.g. Google, Meta, Amazon, Stripe"
                  value={values.targetCompanies}
                  onChange={(event) =>
                    onChange({ ...values, targetCompanies: event.currentTarget.value })
                  }
                />
              </div>

              <div className="onboarding-actions mt-3 flex gap-3">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={isSaving}
                  onClick={onBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={isSaving}
                  onClick={onContinue}
                >
                  {isSaving ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="onboarding-step-title">
              <h2
                id="onboarding-step-title"
                className="m-0 text-[1.05rem] font-semibold text-[var(--text-h)]"
              >
                Pick your focus areas
              </h2>
              <p className="mt-1 text-sm text-[var(--dim)]">
                Select topics you want to practice most. You can change these later.
              </p>

              <div className="onboarding-content-section mt-3">
                <p id="onboarding-topics-label" className="text-sm font-medium text-[var(--text)]">
                  Preferred Topics
                </p>
                <div
                  role="group"
                  aria-labelledby="onboarding-topics-label"
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {ONBOARDING_TOPICS.map((topic) => {
                    const isSelected = values.preferredTopics.includes(topic);

                    return (
                      <button
                        key={topic}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={isSaving}
                        onClick={() => toggleTopic(topic)}
                        className={cn(
                          'onboarding-topic rounded-full border px-3 py-1 text-[0.78rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50',
                          isSelected
                            ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] font-medium text-[var(--accent-strong)]'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border2)] hover:text-[var(--text)]'
                        )}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="onboarding-difficulty mt-3">
                <SelectField
                  id="onboarding-default-difficulty"
                  label="Default Difficulty"
                  placeholder="Select difficulty"
                  options={ONBOARDING_DIFFICULTY_OPTIONS}
                  value={values.defaultDifficulty}
                  disabled={isSaving}
                  onChange={(defaultDifficulty) =>
                    onChange({
                      ...values,
                      defaultDifficulty: defaultDifficulty as typeof values.defaultDifficulty,
                    })
                  }
                />
              </div>

              <div className="onboarding-actions mt-3 flex gap-3">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={isSaving}
                  onClick={onBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={isSaving}
                  onClick={onFinish}
                >
                  {isSaving ? 'Saving...' : 'Start Practicing'}
                </button>
              </div>
            </section>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3 text-sm text-[var(--danger-strong)]"
          >
            <p>{errorMessage}</p>
            {errorDetails && (
              <details className="mt-2 text-xs opacity-80">
                <summary className="cursor-pointer font-medium">Technical detail</summary>
                <p className="mt-1 break-words">{errorDetails}</p>
              </details>
            )}
          </div>
        )}

        <button
          type="button"
          className="onboarding-skip mt-2 w-full rounded-md py-1 text-center text-sm text-[var(--dim)] transition-colors hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
          disabled={isSaving}
          onClick={onSkip}
        >
          Skip for now
        </button>
      </section>
    </main>
  );
};
