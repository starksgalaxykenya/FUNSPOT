import { auth, db, storage } from './firebase-init.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// Check if we're on profile page
if (window.location.pathname.includes('profile.html')) {
    loadUserProfile();
}

async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = '/';
        return;
    }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        // Populate profile fields
        document.getElementById('profileName').value = userData.name || '';
        document.getElementById('profileBio').value = userData.bio || '';
        document.getElementById('profileWebsite').value = userData.website || '';
        
        // Display stats
        document.getElementById('followersCount').textContent = userData.followers || 0;
        document.getElementById('followingCount').textContent = userData.following || 0;
        
        // Load profile image
        if (userData.profileImage) {
            document.getElementById('profileAvatar').src = userData.profileImage;
        }
        
        // Show model-specific fields
        if (userData.isModel) {
            document.getElementById('modelFields').classList.remove('hidden');
            document.getElementById('subscriptionPrice').value = userData.subscriptionPrice || 9.99;
        }
        
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function updateProfile() {
    const user = auth.currentUser;
    if (!user) return;
    
    const name = document.getElementById('profileName').value;
    const bio = document.getElementById('profileBio').value;
    const website = document.getElementById('profileWebsite').value;
    
    try {
        await updateDoc(doc(db, 'users', user.uid), {
            name: name,
            bio: bio,
            website: website,
            updatedAt: new Date()
        });
        
        alert('Profile updated successfully!');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile');
    }
}

async function uploadProfileImage(file) {
    const user = auth.currentUser;
    if (!user) return;
    
    const storageRef = ref(storage, `profile_images/${user.uid}`);
    
    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        await updateDoc(doc(db, 'users', user.uid), {
            profileImage: downloadURL
        });
        
        document.getElementById('profileAvatar').src = downloadURL;
        alert('Profile image updated!');
        
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error uploading image');
    }
}

// Event listeners
document.getElementById('updateProfileBtn')?.addEventListener('click', updateProfile);
document.getElementById('uploadImage')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        uploadProfileImage(e.target.files[0]);
    }
});
