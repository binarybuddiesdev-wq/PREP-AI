import { Select } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/utils';
import type { ISelectFieldProps } from './SelectField.types';
import './SelectField.css';

export const SelectField = (props: ISelectFieldProps) => {
  const {
    id,
    label,
    value,
    placeholder,
    options,
    onChange,
    disabled = false,
    density = 'default',
  } = props;
  const isCompact = density === 'compact';

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
        <Select.Trigger
          id={id}
          className={cn(
            'settings-select-trigger h-9',
            isCompact && 'settings-select-trigger--dense'
          )}
        >
          <Select.Value className="settings-select-value min-w-0 flex-1 truncate">
            {(selectedValue: unknown) => {
              if (typeof selectedValue !== 'string') return placeholder;
              const selectedOption = options.find((option) => option.value === selectedValue);

              return isCompact
                ? (selectedOption?.compactLabel ?? selectedOption?.label ?? selectedValue)
                : (selectedOption?.label ?? selectedValue);
            }}
          </Select.Value>
          <Select.Icon className="settings-select-icon">
            <ChevronDown aria-hidden="true" className="size-4" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            className="settings-select-positioner"
            alignItemWithTrigger={false}
            align="start"
            side="bottom"
            collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'start' }}
            sideOffset={4}
          >
            <Select.Popup
              className={cn(
                'settings-select-popup settings-select-popup--compact',
                isCompact && 'settings-select-popup--dense'
              )}
            >
              <Select.List>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      'settings-select-item min-h-8',
                      isCompact && 'settings-select-item--dense'
                    )}
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
