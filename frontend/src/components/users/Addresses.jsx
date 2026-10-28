import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { fetchProfile, saveAddresses } from '../../services/Userbase/api';
import './Addresses.css';

const empty = { label: '', city: '', street_name: '', house_number: '', is_default: false };
export const addressText = (address) => `${address.street_name} ${address.house_number}, ${address.city}`;

function AddressBook({ onSelect, selectedId }) {
    const { t } = useTranslation();
    const { userId } = useContext(AuthContext) || {};
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(empty);
    const [pendingDelete, setPendingDelete] = useState(null);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setAddresses([]); setEditing(null); setForm(empty); setError(''); setPendingDelete(null);
        onSelect?.(null);
        if (!userId) { setLoading(false); return; }
        fetchProfile().then(profile => {
            if (!active) return;
            const items = profile.addresses || [];
            setAddresses(items);
            onSelect?.(items.find(a => a.id === selectedId) || items.find(a => a.is_default) || items[0] || null);
        }).catch(() => { if (active) setError(t('addressesLoadError')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
        // Selection is initialized once for each signed-in account.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, t]);
    const persist = async (next, preferredId) => {
        setBusy(true); setError('');
        try {
            const profile = await saveAddresses(next);
            const saved = profile.addresses;
            setAddresses(saved);
            onSelect?.(saved.find(a => a.id === preferredId) || saved.find(a => a.id === selectedId) || saved.find(a => a.is_default) || saved[0] || null);
            setEditing(null); setPendingDelete(null);
        } catch { setError(t('addressesSaveError')); }
        finally { setBusy(false); }
    };
    const submit = (event) => {
        event.preventDefault();
        const item = { ...form, label: form.label.trim(), city: form.city.trim(), street_name: form.street_name.trim(), house_number: Number(form.house_number), id: editing === 'new' ? crypto.randomUUID() : editing };
        let next = editing === 'new' ? [...addresses, item] : addresses.map(a => a.id === editing ? item : a);
        if (item.is_default || next.length === 1) next = next.map(a => ({ ...a, is_default: a.id === item.id }));
        persist(next, item.id);
    };
    if (!userId) return <section className="addresses-panel"><Link to="/login">{t('login')}</Link></section>;
    return <section className="addresses-panel" aria-busy={busy || loading}>
        <h2>{t(onSelect ? 'deliveryAddress' : 'myAddresses')}</h2>
        <p>{t('addressesNote')}</p>
        {error && <p role="alert">{error}</p>}
        {loading ? <p role="status">{t('loading')}</p> : <>
            {!addresses.length && <p>{t('noAddresses')}</p>}
            <div className="address-list">{addresses.map(address => <article className={`address-card ${selectedId === address.id ? 'selected' : ''}`} key={address.id}>
                {onSelect ? <label className="address-choice"><input type="radio" name="delivery-address" checked={selectedId === address.id} disabled={busy} onChange={() => onSelect(address)} /><strong>{address.label}</strong></label> : <strong>{address.label}</strong>}
                <p>{addressText(address)}</p>
                {address.is_default && <span className="address-badge">{t('defaultAddress')}</span>}
                <div className="address-actions">
                    <button disabled={busy} onClick={() => { setEditing(address.id); setForm(address); }}>{t('editAddress')}</button>
                    {!address.is_default && <button disabled={busy} onClick={() => persist(addresses.map(a => ({ ...a, is_default: a.id === address.id })))}>{t('makeDefaultAddress')}</button>}
                    <button disabled={busy} onClick={() => setPendingDelete(address.id)}>{t('deleteAddress')}</button>
                </div>
                {pendingDelete === address.id && <div><p>{t('confirmDeleteAddress')}</p><button disabled={busy} onClick={() => { const next = addresses.filter(a => a.id !== address.id); if (address.is_default && next[0]) next[0] = { ...next[0], is_default: true }; persist(next); }}>{t('deleteAddress')}</button> <button disabled={busy} onClick={() => setPendingDelete(null)}>{t('cancelAddress')}</button></div>}
            </article>)}</div>
            {editing === null ? <button disabled={busy || addresses.length >= 20} onClick={() => { setEditing('new'); setForm({ ...empty, is_default: !addresses.length }); }}>{t('addAddress')}</button> : <form className="address-form" onSubmit={submit}>
                <h3>{t(editing === 'new' ? 'addAddress' : 'editAddress')}</h3>
                {['label', 'city', 'street_name', 'house_number'].map(field => <label key={field} htmlFor={`address-${field}`}>{t(`addressField_${field}`)}<input id={`address-${field}`} required disabled={busy} type={field === 'house_number' ? 'number' : 'text'} min={field === 'house_number' ? 1 : undefined} max={field === 'house_number' ? 999999 : undefined} maxLength={field === 'city' ? 20 : field === 'label' ? 40 : 50} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}
                <label className="address-choice"><input type="checkbox" checked={form.is_default} disabled={busy} onChange={e => setForm({ ...form, is_default: e.target.checked })} />{t('makeDefaultAddress')}</label>
                <div className="address-actions"><button disabled={busy} type="submit">{t(busy ? 'savingAddress' : 'saveAddress')}</button><button disabled={busy} type="button" onClick={() => setEditing(null)}>{t('cancelAddress')}</button></div>
            </form>}
        </>}
    </section>;
}

export default function Addresses(props) {
    const { userId } = useContext(AuthContext) || {};
    return <AddressBook key={userId || 'guest'} {...props} />;
}
