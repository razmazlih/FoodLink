import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

let auth;
export function getFirebaseAuth() {
    if (auth) return auth;
    const emulator = process.env.REACT_APP_USE_FIREBASE_EMULATORS === 'true';
    const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;
    if (!projectId || (emulator && !projectId.startsWith('demo-'))) {
        throw new Error('Configure a Firebase project; emulators require a demo- project ID.');
    }
    const app = getApps()[0] || initializeApp({
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY || (emulator ? 'demo-api-key' : undefined),
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
        projectId,
        appId: process.env.REACT_APP_FIREBASE_APP_ID,
    });
    auth = getAuth(app);
    if (emulator) connectAuthEmulator(auth, process.env.REACT_APP_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', { disableWarnings: true });
    return auth;
}

export async function getAccessToken() {
    const instance = getFirebaseAuth();
    await instance.authStateReady();
    return instance.currentUser ? instance.currentUser.getIdToken() : null;
}
