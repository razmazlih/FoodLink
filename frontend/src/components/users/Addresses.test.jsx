import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Addresses from './Addresses';
import { AuthContext } from '../../context/AuthContext';
import { fetchProfile, saveAddresses } from '../../services/Userbase/api';

jest.mock('../../services/Userbase/api', () => ({ fetchProfile: jest.fn(), saveAddresses: jest.fn() }));
jest.mock('react-router-dom', () => ({ Link: ({ children }) => <span>{children}</span> }), { virtual: true });
jest.mock('react-i18next', () => { const t = key => key; return { useTranslation: () => ({ t }) }; });
const home = { id: 'home', label: 'Home', city: 'Haifa', street_name: 'Main', house_number: 1, is_default: true };
const work = { ...home, id: 'work', label: 'Work', house_number: 2, is_default: false };
let host, root;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); host = document.createElement('div'); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); });
const render = async (userId, props = {}) => { await act(async () => root.render(<AuthContext.Provider value={{ userId }}><Addresses {...props} /></AuthContext.Provider>)); };
const click = async text => { await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === text).click()); };

test('selects default address and allows a different delivery destination', async () => {
    fetchProfile.mockResolvedValue({ addresses: [work, home] });
    const onSelect = jest.fn();
    await render('alice', { onSelect, selectedId: 'home' });
    expect(onSelect).toHaveBeenCalledWith(home);
    await act(async () => host.querySelector('input[type=radio]').click());
    expect(onSelect).toHaveBeenLastCalledWith(work);
});

test('a late profile response from an old account cannot replace the new account addresses', async () => {
    let resolveOld;
    fetchProfile.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ addresses: [work] });
    const onSelect = jest.fn();
    await render('alice', { onSelect });
    await render('bob', { onSelect });
    await act(async () => resolveOld({ addresses: [home] }));
    expect(host.textContent).toContain('Work');
    expect(host.textContent).not.toContain('Home');
    expect(onSelect.mock.calls.filter(([address]) => address !== null)).toEqual([[work]]);
});

test('failed default update retains the persisted addresses and displays an error', async () => {
    fetchProfile.mockResolvedValue({ addresses: [home, work] });
    saveAddresses.mockRejectedValue(new Error('offline'));
    await render('alice');
    await click('makeDefaultAddress');
    expect(saveAddresses).toHaveBeenCalledWith([{ ...home, is_default: false }, { ...work, is_default: true }]);
    expect(host.querySelector('[role=alert]').textContent).toBe('addressesSaveError');
    expect(host.querySelectorAll('.address-badge')).toHaveLength(1);
    expect(host.querySelector('.address-badge').closest('article').textContent).toContain('Home');
});

test('deleting the default requires confirmation and promotes the remaining address', async () => {
    fetchProfile.mockResolvedValue({ addresses: [home, work] });
    saveAddresses.mockResolvedValue({ addresses: [{ ...work, is_default: true }] });
    await render('alice');
    await click('deleteAddress');
    expect(saveAddresses).not.toHaveBeenCalled();
    const confirm = host.querySelector('.address-card').querySelectorAll('button')[2];
    await act(async () => confirm.click());
    expect(saveAddresses).toHaveBeenCalledWith([{ ...work, is_default: true }]);
    expect(host.textContent).not.toContain('Home');
});

test('switching accounts clears the previous destination even when the new profile fails', async () => {
    fetchProfile.mockResolvedValueOnce({ addresses: [home] }).mockRejectedValueOnce(new Error('offline'));
    const onSelect = jest.fn();
    await render('alice', { onSelect });
    expect(host.textContent).toContain('Home');
    await render('bob', { onSelect });
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(host.textContent).not.toContain('Home');
    expect(host.querySelector('[role=alert]').textContent).toBe('addressesLoadError');
});
