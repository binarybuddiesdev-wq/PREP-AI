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
        className="h-4 w-4 rounded border-white/20 bg-[#09090b] text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <label htmlFor={id} className="text-sm text-zinc-300">
        {label}
      </label>
    </div>
  );
};
