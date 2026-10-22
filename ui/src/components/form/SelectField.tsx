import type { ISelectFieldProps } from './SelectField.types';

export const SelectField = (props: ISelectFieldProps) => {
  const { id, label, value, placeholder, options, onChange } = props;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-400 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 bg-[#09090b] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
