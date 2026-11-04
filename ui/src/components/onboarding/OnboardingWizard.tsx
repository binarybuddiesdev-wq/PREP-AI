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
  'mt-1.5 w-full rounded-lg border border-white/10 bg-[#09090b] px-4 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15';
const primaryButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60';

const secondaryButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60';

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
      className="onboarding-screen relative isolate flex h-svh min-h-svh items-center justify-center overflow-hidden bg-[#09090b] px-4 py-3 font-['DM_Sans',sans-serif] text-zinc-100"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_42%,rgba(245,158,11,0.08),transparent_34rem)]"
      />
      <section
        aria-labelledby="onboarding-title"
        className="onboarding-card relative w-full max-w-[520px] rounded-2xl border border-white/[0.08] bg-[#18181b] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:p-6"
      >
        <header className="onboarding-header mb-4 text-center">
          <div className="mb-1 flex justify-center">{brand}</div>
          <h1
            id="onboarding-title"
            className="m-0 text-[1.3rem] font-semibold leading-tight tracking-tight text-zinc-50"
          >
            Let’s set up your profile
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Practice that fits your goals.</p>
        </header>

        <ol
          aria-label="Setup progress"
          className="onboarding-progress mb-4 flex items-center gap-2 px-1 sm:gap-3"
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
                  step === currentStep.value && 'border-amber-500 bg-amber-500/10 text-amber-300',
                  step > currentStep.value && 'border-emerald-500 bg-emerald-500 text-white',
                  step < currentStep.value && 'border-white/10 bg-[#09090b] text-zinc-500'
                )}
              >
                {step > currentStep.value ? '✓' : currentStep.value}
              </span>
              {currentStep.value < STEPS.length && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'ml-2 h-0.5 min-w-3 flex-1 rounded-full transition-colors sm:ml-3',
                    step > currentStep.value ? 'bg-emerald-500' : 'bg-white/10'
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
                className="m-0 text-[1.05rem] font-semibold text-zinc-50"
              >
                Tell us about your target role
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                We’ll tailor questions for your target role.
              </p>

              <div className="onboarding-fields mt-4 space-y-2.5">
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
                className="m-0 text-[1.05rem] font-semibold text-zinc-50"
              >
                Where are you applying?
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Optional — focus questions on companies you want to join.
              </p>

              <div className="onboarding-content-section mt-4">
                <label
                  htmlFor="onboarding-target-companies"
                  className="text-[0.8rem] font-medium text-zinc-300"
                >
                  Target Companies <span className="font-normal text-zinc-500">(optional)</span>
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

              <div className="onboarding-actions mt-4 flex gap-3">
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
                className="m-0 text-[1.05rem] font-semibold text-zinc-50"
              >
                Pick your focus areas
              </h2>
              <p className="mt-1 text-sm text-zinc-400">Choose your focus topics for practice.</p>

              <div className="onboarding-content-section mt-4">
                <p id="onboarding-topics-label" className="text-sm font-medium text-zinc-300">
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
                          'onboarding-topic rounded-full border px-3 py-1 text-[0.78rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50',
                          isSelected
                            ? 'border-amber-500/40 bg-amber-500/10 font-medium text-amber-300'
                            : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-100'
                        )}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="onboarding-difficulty mt-4">
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

              <div className="onboarding-actions mt-4 flex gap-3">
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
            className="mt-5 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200"
          >
            <p>{errorMessage}</p>
            {errorDetails && (
              <details className="mt-2 text-xs text-red-200/70">
                <summary className="cursor-pointer font-medium">Technical detail</summary>
                <p className="mt-1 break-words">{errorDetails}</p>
              </details>
            )}
          </div>
        )}

        <button
          type="button"
          className="onboarding-skip mt-3 w-full rounded-md py-1 text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60"
          disabled={isSaving}
          onClick={onSkip}
        >
          Skip for now
        </button>
      </section>
    </main>
  );
};
