import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CheckboxField } from './CheckboxField';

describe('CheckboxField', () => {
  it('associates the visible label with the controlled checkbox', () => {
    render(<CheckboxField id="daily-email" label="Email me daily" checked onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Email me daily' })).toBeChecked();
    expect(screen.getByLabelText('Email me daily')).toHaveAttribute('id', 'daily-email');
  });

  it.each([true, false])('reports the new checked value (%s)', async (checked) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CheckboxField id="alerts" label="Alerts" checked={!checked} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Alerts' }));

    expect(onChange).toHaveBeenCalledWith(checked);
  });

  it('does not emit changes from a disabled checkbox', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CheckboxField
        id="locked"
        label="Locked option"
        checked={false}
        disabled
        onChange={onChange}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Locked option' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Locked option' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
