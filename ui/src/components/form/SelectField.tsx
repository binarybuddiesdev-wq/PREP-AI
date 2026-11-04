import { Select } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

import type { ISelectFieldProps } from './SelectField.types';
import './SelectField.css';

export const SelectField = (props: ISelectFieldProps) => {
  const { id, label, value, placeholder, options, onChange, disabled = false } = props;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[0.8rem] font-medium text-zinc-400">
        {label}
      </label>
      <Select.Root
        value={value || null}
        modal={false}
        onValueChange={(nextValue) => onChange(nextValue ?? '')}
        disabled={disabled}
      >
        <Select.Trigger id={id} className="settings-select-trigger">
          <Select.Value placeholder={placeholder} />
          <Select.Icon className="settings-select-icon">
            <ChevronDown aria-hidden="true" className="size-4" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className="settings-select-positioner" sideOffset={6}>
            <Select.Popup className="settings-select-popup">
              <Select.List>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className="settings-select-item"
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="settings-select-indicator">
                      <Check aria-hidden="true" className="size-4" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};
