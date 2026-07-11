import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';

describe('Login', () => {
  it('submits credentials and returns the authenticated payload', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const payload = { token: 'signed-token', user: { id: 'user-1', role: 'cashier' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    }));

    render(<Login onLogin={onLogin} />);
    await user.type(screen.getByLabelText('Email or phone'), 'cashier@example.local');
    await user.type(screen.getByLabelText('Password'), 'cashier12345');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        identifier: 'cashier@example.local',
        password: 'cashier12345'
      })
    }));
    expect(onLogin).toHaveBeenCalledWith(payload);
    vi.unstubAllGlobals();
  });

  it('shows the API error and keeps the user on the form', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid login details' })
    }));

    render(<Login />);
    await user.type(screen.getByLabelText('Email or phone'), 'wrong@example.local');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid login details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    vi.unstubAllGlobals();
  });
});
