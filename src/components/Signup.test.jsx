import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Signup from './Signup';

describe('Signup', () => {
  it('provisions a store through the public signup endpoint', async () => {
    const user = userEvent.setup();
    const onSignupSuccess = vi.fn();
    const payload = {
      token: 'signed-token',
      user: { id: 'owner-1', role: 'admin' },
      tenant: { id: 'tenant-1', status: 'pending_payment' }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    render(<Signup initialPlan="growth" onSignupSuccess={onSignupSuccess} />);
    await user.type(screen.getByLabelText('Business Name'), 'Vosky Analytics');
    await user.type(screen.getByLabelText('Owner Email Address'), 'kelvin@store.com');
    await user.type(screen.getByLabelText('Owner Password'), 'secure-pass');
    await user.click(screen.getByRole('button', { name: 'Create my Jijenge store' }));

    expect(fetch).toHaveBeenCalledWith('/api/signup', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        businessName: 'Vosky Analytics',
        email: 'kelvin@store.com',
        phone: '',
        password: 'secure-pass',
        currency: 'KES',
        timezone: 'Africa/Nairobi',
        plan: 'growth'
      })
    }));
    expect(onSignupSuccess).toHaveBeenCalledWith(payload.token, payload.user, payload.tenant);
    vi.unstubAllGlobals();
  });
});
