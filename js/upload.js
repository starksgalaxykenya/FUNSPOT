import { auth, db, storage } from './firebase-init.js';
import { 
    collection, addDoc, serverTimestamp, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { 
    ref, uploadBytesResumable, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// State
let currentUser = null;
let currentUserData = null;
let selectedFile = null;
let mediaType = 'photo';
let uploadTask = null;

// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const mediaFileInput = document.getElementById('mediaFile');
const uploadArea = document.getElementById('uploadArea');
const filePreview = document.getElementById('filePreview');
const selectFileBtn = document.getElementById('selectFileBtn');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const categorySelect = document.getElementById('category');
const isPremiumCheckbox = document.getElementById('isPremium');
const ageRestrictedCheckbox = document.getElementById('ageRestricted');
const submitBtn = document.getElementById('submitBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');
const typeBtns = document.querySelectorAll('.type-btn');

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        
        // Check if user is a model
        if (!currentUserData?.isModel) {
            alert('Only creators can upload content');
            window.location.href = 'gallery.html';
            return;
        }
        
        // Update UI with user info
        document.getElementById('userName').textContent = currentUserData.name || currentUser.email;
        if (currentUserData.profileImage) {
            document.getElementById('userAvatar').src = currentUserData.profileImage;
        }
    } else {
        window.location.href = '../index.html';
    }
});

async function loadUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        currentUserData = userDoc.data();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Media type selection
typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mediaType = btn.dataset.type;
        
        // Clear selected file when changing type
        selectedFile = null;
        filePreview.classList.add('hidden');
        filePreview.innerHTML = '';
        mediaFileInput.value = '';
        submitBtn.disabled = true;
    });
});

// File selection handlers
uploadArea.addEventListener('click', () => {
    mediaFileInput.click();
});

selectFileBtn.addEventListener('click', () => {
    mediaFileInput.click();
});

mediaFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileSelection(file);
    }
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary)';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--light-gray)';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--light-gray)';
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFileSelection(file);
    }
});

function handleFileSelection(file) {
    // Validate file type
    if (mediaType === 'photo' && !file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    if (mediaType === 'video' && !file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
    }
    
    // Validate file size (max 500MB for videos, 50MB for images)
    const maxSize = mediaType === 'video' ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(`File too large. Max size: ${maxSize / (1024 * 1024)}MB`);
        return;
    }
    
    selectedFile = file;
    
    // Preview file
    const reader = new FileReader();
    reader.onload = (e) => {
        filePreview.classList.remove('hidden');
        if (mediaType === 'photo') {
            filePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        } else {
            filePreview.innerHTML = `<video src="${e.target.result}" controls></video>`;
        }
    };
    reader.readAsDataURL(file);
    
    submitBtn.disabled = false;
}

// Form submission
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
        alert('Please select a file to upload');
        return;
    }
    
    const title = titleInput.value.trim();
    if (!title) {
        alert('Please enter a title');
        return;
    }
    
    // Disable submit button and show progress
    submitBtn.disabled = true;
    uploadProgress.classList.remove('hidden');
    
    try {
        // Create unique filename
        const timestamp = Date.now();
        const fileExtension = selectedFile.name.split('.').pop();
        const fileName = `${currentUser.uid}/${timestamp}.${fileExtension}`;
        const storageRef = ref(storage, `content/${fileName}`);
        
        // Start upload
        uploadTask = uploadBytesResumable(storageRef, selectedFile);
        
        // Monitor upload progress
        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `Uploading... ${Math.round(progress)}%`;
            },
            (error) => {
                console.error('Upload error:', error);
                alert('Error uploading file. Please try again.');
                submitBtn.disabled = false;
                uploadProgress.classList.add('hidden');
            },
            async () => {
                // Upload completed, get download URL
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // Generate thumbnail for videos
                let thumbnail = null;
                if (mediaType === 'video') {
                    thumbnail = await generateVideoThumbnail(selectedFile);
                }
                
                // Save gallery data to Firestore
                const galleryData = {
                    modelId: currentUser.uid,
                    modelName: currentUserData.name,
                    title: title,
                    description: descriptionInput.value,
                    category: categorySelect.value,
                    mediaType: mediaType,
                    url: downloadURL,
                    storagePath: `content/${fileName}`,
                    thumbnail: thumbnail,
                    isPremium: isPremiumCheckbox.checked,
                    ageRestricted: ageRestrictedCheckbox.checked,
                    likes: 0,
                    views: 0,
                    downloads: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                
                await addDoc(collection(db, 'galleries'), galleryData);
                
                progressText.textContent = 'Upload complete! Redirecting...';
                progressFill.style.width = '100%';
                
                setTimeout(() => {
                    window.location.href = 'gallery.html';
                }, 1500);
            }
        );
        
    } catch (error) {
        console.error('Error uploading:', error);
        alert('Error uploading content. Please try again.');
        submitBtn.disabled = false;
        uploadProgress.classList.add('hidden');
    }
});

// Generate video thumbnail
async function generateVideoThumbnail(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        video.addEventListener('loadeddata', () => {
            video.currentTime = 1; // Capture frame at 1 second
        });
        
        video.addEventListener('seeked', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg');
            resolve(thumbnail);
            URL.revokeObjectURL(video.src);
        });
        
        video.addEventListener('error', (error) => {
            reject(error);
        });
        
        video.src = URL.createObjectURL(file);
    });
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (uploadTask && uploadTask.snapshot.state === 'running') {
        uploadTask.cancel();
    }
});
