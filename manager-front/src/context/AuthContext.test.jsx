import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { AuthContext, AuthProvider } from './AuthContext';
jest.mock('../firebase', () => ({ getFirebaseAuth: () => 'auth' }));
jest.mock('firebase/auth', () => ({ onIdTokenChanged: jest.fn(), signInWithEmailAndPassword: jest.fn(), signOut: jest.fn() }));
let root, host, session, listener;
const user = (role) => ({ uid: 'uid', email: 'manager@example.test', getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role } }) });
function Probe() { session = useContext(AuthContext); return <span>{session.auth.user?.name || 'Guest'}</span>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); localStorage.clear();
  onIdTokenChanged.mockImplementation((auth, callback) => { listener = callback; callback(null); return jest.fn(); });
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });
const mount = () => act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
test('admin signs in through Firebase and logs out without storing bearer tokens', async () => {
  signInWithEmailAndPassword.mockResolvedValue({ user: user('admin') }); await mount();
  await act(async () => { expect(await session.login('manager@example.test', 'password')).toBe('admin'); });
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith('auth', 'manager@example.test', 'password');
  expect(host.textContent).toBe('manager@example.test'); expect(localStorage.getItem('auth')).toBeNull();
  await act(async () => session.logout()); expect(signOut).toHaveBeenCalledWith('auth'); expect(host.textContent).toBe('Guest');
});
test('restores access only from Firebase claims, removes obsolete stored session', async () => {
  localStorage.setItem('auth', '{"token":"obsolete"}'); await mount();
  await act(async () => listener(user('restaurant_owner')));
  expect(session.auth.user.role).toBe('restaurant_owner'); expect(localStorage.getItem('auth')).toBeNull();
});
test('customers are rejected and failed sign-in stays logged out', async () => {
  signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('customer') }).mockRejectedValueOnce(new Error('Unauthorized'));
  await mount();
  await act(async () => { expect(await session.login('customer@example.test', 'password')).toBe(false); });
  expect(signOut).toHaveBeenCalled();
  await act(async () => { expect(await session.login('wrong@example.test', 'wrong')).toBe(false); });
  expect(session.auth.user).toBeNull();
});
