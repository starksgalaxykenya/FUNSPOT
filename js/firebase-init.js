import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// Your Firebase configuration (replace with your actual config)
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyABSjE0uM9dNS89-Ttf1MBX-YOkq_q-SyM",
  authDomain: "funspot-24bdb.firebaseapp.com",
  projectId: "funspot-24bdb",
  storageBucket: "funspot-24bdb.firebasestorage.app",
  messagingSenderId: "483223267240",
  appId: "1:483223267240:web:72112036d82f43e59d5f9d",
  measurementId: "G-RDF99ZY2HY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

// Auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('User logged in:', user.uid);
        updateUIForLoggedInUser(user);
    } else {
        console.log('User logged out');
        updateUIForLoggedOutUser();
    }
});

function updateUIForLoggedInUser(user) {
    const authBtn = document.getElementById('authBtn');
    const userMenu = document.getElementById('userMenu');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (authBtn && userMenu) {
        authBtn.classList.add('hidden');
        userMenu.classList.remove('hidden');
        
        if (userName) userName.textContent = user.displayName || user.email;
        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
    }
}

function updateUIForLoggedOutUser() {
    const authBtn = document.getElementById('authBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (authBtn && userMenu) {
        authBtn.classList.remove('hidden');
        userMenu.classList.add('hidden');
    }
}
