import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCX-ag3dli4j1DyP4nJKiO58yOEyQy-_5c",
    authDomain: "invest-foram-platform.firebaseapp.com",
    projectId: "invest-foram-platform",
    storageBucket: "invest-foram-platform.firebasestorage.app",
    messagingSenderId: "284475751069",
    appId: "1:284475751069:web:008f29e8696f483c19b274"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support offline persistence.');
    }
});

// Set persistence to local
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log('Auth persistence set to local');
    })
    .catch((error) => {
        console.error("Auth persistence error:", error);
    });

export { auth, db };