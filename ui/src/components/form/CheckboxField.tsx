import type { ICheckboxFieldProps } from './CheckboxField.types';

export const CheckboxField = (props: ICheckboxFieldProps) => {
  const { id, label, checked, disabled = false, onChange } = props;

  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--border2)] bg-[var(--bg2)] accent-[var(--accent)] focus:ring-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <label htmlFor={id} className="text-sm text-[var(--text)]">
        {label}
      </label>
    </div>
  );
};
