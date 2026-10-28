import { getMenuItemNameById } from './api';

const pending = new Map();

export const readMenuItemNames = () => {
    try {
        const names = JSON.parse(localStorage.getItem('cartNames'));
        return names && typeof names === 'object' && !Array.isArray(names) ? names : {};
    } catch {
        return {};
    }
};

export const resolveMenuItemName = (id) => {
    const cached = readMenuItemNames()[id];
    if (cached) return Promise.resolve(cached);
    if (!pending.has(id)) {
        const request = getMenuItemNameById(id).then((name) => {
            if (name) localStorage.setItem('cartNames', JSON.stringify({ ...readMenuItemNames(), [id]: name }));
            return name;
        }).finally(() => pending.delete(id));
        pending.set(id, request);
    }
    return pending.get(id);
};

export const resolveMenuItemNames = async (items) => {
    const ids = [...new Set(items.filter((item) => !item.name).map((item) => item.menu_item_id))];
    const entries = await Promise.all(ids.map(async (id) => [id, await resolveMenuItemName(id)]));
    return Object.fromEntries([
        ...entries,
        ...items.filter((item) => item.name).map((item) => [item.menu_item_id, item.name]),
    ]);
};
