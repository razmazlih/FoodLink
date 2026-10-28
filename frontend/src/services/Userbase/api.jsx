import axios from 'axios';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, deleteUser } from 'firebase/auth';
import { getFirebaseAuth } from '../../firebase';
import { API_USERBASE_URL } from '../../config';

export const userCredentials = async ({ email, username, password }) => {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email || username, password);
    return credential.user;
};

export const registerUser = async ({ email, password, ...profile }) => {
    const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    try {
        await updateProfile(credential.user, { displayName: profile.username });
        const token = await credential.user.getIdToken();
        await axios.post(`${API_USERBASE_URL}/users/register/`, profile, { headers: { Authorization: `Bearer ${token}` } });
        return credential.user;
    } catch (error) {
        // Roll back only the just-created account when profile setup fails.
        await deleteUser(credential.user).catch(() => {});
        throw error;
    }
};

export const fetchProfile = async () => (await axios.get(`${API_USERBASE_URL}/users/profile/`)).data;
export const saveAddresses = async (addresses) => (await axios.patch(`${API_USERBASE_URL}/users/profile/`, { addresses })).data;
