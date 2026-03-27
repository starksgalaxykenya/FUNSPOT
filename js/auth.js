import { auth, db } from './firebase-init.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// DOM Elements
const authModal = document.getElementById('authModal');
const authBtn = document.getElementById('authBtn');
const closeModal = document.querySelector('.close');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const tabBtns = document.querySelectorAll('.tab-btn');
const logoutBtn = document.getElementById('logoutBtn');

// Modal controls
if (authBtn) {
    authBtn.addEventListener('click', () => {
        authModal.classList.remove('hidden');
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        authModal.classList.add('hidden');
    });
}

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active form
        const loginFormElement = document.getElementById('loginForm');
        const signupFormElement = document.getElementById('signupForm');
        
        if (tab === 'login') {
            loginFormElement.classList.add('active');
            signupFormElement.classList.remove('active');
        } else {
            loginFormElement.classList.remove('active');
            signupFormElement.classList.add('active');
        }
    });
});

// Sign Up Function
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const role = document.getElementById('signupRole').value;
        
        if (!role) {
            alert('Please select whether you are a fan or creator');
            return;
        }
        
        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update profile with name
            await updateProfile(user, {
                displayName: name
            });
            
            // Create user document in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                role: role,
                subscriptionStatus: 'inactive',
                isModel: role === 'model',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                profileViews: 0,
                followers: 0,
                following: 0
            });
            
            // Close modal
            authModal.classList.add('hidden');
            
            // Show success message
            alert(`Welcome to ConnectHub${role === 'model' ? '! Complete your creator profile to start earning.' : '! Start exploring premium content.'}`);
            
            // Redirect based on role
            if (role === 'model') {
                window.location.href = '/pages/dashboard.html';
            }
            
        } catch (error) {
            console.error('Signup error:', error);
            alert(error.message);
        }
    });
}

// Login Function
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Get user role from Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            
            authModal.classList.add('hidden');
            
            // Redirect based on role
            if (userData && userData.role === 'model') {
                window.location.href = '/pages/dashboard.html';
            }
            
        } catch (error) {
            console.error('Login error:', error);
            alert('Invalid email or password');
        }
    });
}

// Google Sign In
const googleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if user document exists
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            // Create new user document
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                role: 'user', // Default role, can be changed later
                subscriptionStatus: 'inactive',
                isModel: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                profileViews: 0,
                followers: 0,
                following: 0
            });
        }
        
        authModal.classList.add('hidden');
        
    } catch (error) {
        console.error('Google sign in error:', error);
        alert('Google sign in failed');
    }
};

document.getElementById('googleLogin')?.addEventListener('click', googleSignIn);
document.getElementById('googleSignup')?.addEventListener('click', googleSignIn);

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.classList.add('hidden');
    }
});
