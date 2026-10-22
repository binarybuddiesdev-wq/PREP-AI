import type { ICheckboxFieldProps } from './CheckboxField.types';

export const CheckboxField = (props: ICheckboxFieldProps) => {
  const { id, label, checked, onChange } = props;

  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="w-4 h-4 rounded border-white/20 bg-[#09090b] text-amber-500 focus:ring-amber-500"
      />
      <label htmlFor={id} className="text-sm text-zinc-300">
        {label}
      </label>
    </div>
  );
};
