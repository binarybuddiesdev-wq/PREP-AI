import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectField } from './SelectField';

describe('SelectField', () => {
  it('shows a compact selected label while keeping the full option name in the menu', async () => {
    const user = userEvent.setup();
    render(
      <SelectField
        id="target-role"
        label="Target Role"
        placeholder="Select role"
        options={[{ value: 'backend', label: 'Backend Engineer', compactLabel: 'Backend' }]}
        value="backend"
        density="compact"
        onChange={vi.fn()}
      />
    );

    const dropdown = screen.getByRole('combobox', { name: 'Target Role' });
    expect(dropdown).toHaveTextContent('Backend');

    await user.click(dropdown);

    expect(await screen.findByRole('option', { name: 'Backend Engineer' })).toBeInTheDocument();
  });

  it('opens a styled option menu and reports the selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectField
        id="target-role"
        label="Target Role"
        placeholder="Select role"
        options={[
          { value: 'frontend', label: 'Frontend Engineer' },
          { value: 'backend', label: 'Backend Engineer' },
        ]}
        value=""
        onChange={onChange}
      />
    );

    const dropdown = screen.getByRole('combobox', { name: 'Target Role' });
    expect(screen.getByText('Target Role')).toHaveClass('text-[var(--dim)]');
    expect(dropdown).toHaveClass('settings-select-trigger', 'h-9');
    expect(dropdown.parentElement?.querySelector('svg')).toBeInTheDocument();

    await user.click(dropdown);
    expect(document.body.style.overflow).not.toBe('hidden');
    const option = await screen.findByRole('option', { name: 'Backend Engineer' });
    expect(option.closest('.settings-select-popup')).toBeInTheDocument();
    expect(option.closest('.settings-select-popup')).toHaveClass('settings-select-popup--compact');
    expect(option.closest('.settings-select-positioner')).toHaveAttribute('data-align', 'start');
    expect(option).toHaveClass('min-h-8');
    await user.click(option);
    expect(onChange).toHaveBeenCalledWith('backend');
  });
});
