import { auth, db, storage } from './firebase-init.js';
import { 
    collection, query, where, getDocs, orderBy, limit, startAfter, 
    doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove,
    onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// State
let currentUser = null;
let currentUserData = null;
let galleries = [];
let lastDoc = null;
let hasMore = true;
let isLoading = false;
let currentFilter = 'all';
let selectedGallery = null;
let currentMediaIndex = 0;

// DOM Elements
const galleryGrid = document.getElementById('galleryGrid');
const premiumModal = document.getElementById('premiumModal');
const subscribeBtn = document.getElementById('subscribeBtn');
const closePremiumModal = document.getElementById('closePremiumModal');
const lightboxModal = document.getElementById('lightboxModal');
const likeBtn = document.getElementById('likeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        loadGalleries();
        checkIfUserIsModel();
    } else {
        window.location.href = '../index.html';
    }
});

async function loadUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        currentUserData = userDoc.data();
        
        // Update UI with user info
        document.getElementById('userName').textContent = currentUserData.name || currentUser.email;
        if (currentUserData.profileImage) {
            document.getElementById('userAvatar').src = currentUserData.profileImage;
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function checkIfUserIsModel() {
    const uploadBtn = document.getElementById('uploadBtn');
    if (currentUserData && currentUserData.isModel) {
        uploadBtn.classList.remove('hidden');
    }
}

// Load galleries with pagination
async function loadGalleries(loadMore = false) {
    if (isLoading || (!loadMore && !hasMore && lastDoc !== null)) return;
    
    isLoading = true;
    
    if (!loadMore) {
        galleryGrid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading galleries...</div>';
    }
    
    try {
        let q;
        
        if (currentFilter === 'all') {
            q = query(
                collection(db, 'galleries'),
                orderBy('createdAt', 'desc'),
                limit(12)
            );
        } else {
            q = query(
                collection(db, 'galleries'),
                where('mediaType', '==', currentFilter),
                orderBy('createdAt', 'desc'),
                limit(12)
            );
        }
        
        // If loading more, add startAfter
        if (loadMore && lastDoc) {
            q = query(q, startAfter(lastDoc));
        }
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty && !loadMore) {
            galleryGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-images"></i>
                    <h3>No galleries yet</h3>
                    <p>Check back later for premium content!</p>
                </div>
            `;
            isLoading = false;
            return;
        }
        
        const newGalleries = [];
        querySnapshot.forEach((doc) => {
            newGalleries.push({ id: doc.id, ...doc.data() });
        });
        
        if (loadMore) {
            galleries = [...galleries, ...newGalleries];
        } else {
            galleries = newGalleries;
        }
        
        lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        hasMore = querySnapshot.docs.length === 12;
        
        renderGalleries();
        
    } catch (error) {
        console.error('Error loading galleries:', error);
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading galleries</h3>
                <p>Please try again later</p>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// Render galleries
function renderGalleries() {
    if (!galleryGrid) return;
    
    if (galleries.length === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images"></i>
                <h3>No galleries found</h3>
                <p>Check back later for new content!</p>
            </div>
        `;
        return;
    }
    
    galleryGrid.innerHTML = galleries.map(gallery => `
        <div class="gallery-card" data-gallery='${JSON.stringify(gallery)}'>
            <div class="gallery-media">
                ${gallery.mediaType === 'video' ? 
                    `<video src="${gallery.thumbnail || gallery.url}" preload="metadata"></video>` :
                    `<img src="${gallery.thumbnail || gallery.url}" alt="${gallery.title}">`
                }
                ${gallery.isPremium && currentUserData?.subscriptionStatus !== 'active' ? 
                    '<div class="premium-badge"><i class="fas fa-crown"></i> Premium</div>' : ''
                }
            </div>
            <div class="gallery-info">
                <h3>${gallery.title || 'Untitled'}</h3>
                <p>${gallery.description || ''}</p>
                <div class="gallery-stats">
                    <span><i class="fas fa-heart"></i> ${gallery.likes || 0}</span>
                    <span><i class="fas fa-eye"></i> ${gallery.views || 0}</span>
                    <span><i class="fas fa-download"></i> ${gallery.downloads || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers to gallery cards
    document.querySelectorAll('.gallery-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const gallery = JSON.parse(card.dataset.gallery);
            openGallery(gallery);
        });
    });
    
    // Add infinite scroll
    setupInfiniteScroll();
}

function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
            loadGalleries(true);
        }
    }, { threshold: 0.1 });
    
    const sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    galleryGrid.appendChild(sentinel);
    observer.observe(sentinel);
}

// Open gallery item in lightbox
async function openGallery(gallery) {
    selectedGallery = gallery;
    
    // Check if premium and user doesn't have subscription
    if (gallery.isPremium && currentUserData?.subscriptionStatus !== 'active') {
        premiumModal.classList.remove('hidden');
        return;
    }
    
    // Increment view count
    await updateDoc(doc(db, 'galleries', gallery.id), {
        views: increment(1)
    });
    
    // Get full resolution media URL
    let mediaUrl = gallery.url;
    if (gallery.storagePath) {
        const storageRef = ref(storage, gallery.storagePath);
        mediaUrl = await getDownloadURL(storageRef);
    }
    
    // Display in lightbox
    if (gallery.mediaType === 'video') {
        document.getElementById('lightboxImage').style.display = 'none';
        const videoEl = document.getElementById('lightboxVideo');
        videoEl.style.display = 'block';
        videoEl.src = mediaUrl;
        videoEl.load();
    } else {
        document.getElementById('lightboxVideo').style.display = 'none';
        const imgEl = document.getElementById('lightboxImage');
        imgEl.style.display = 'block';
        imgEl.src = mediaUrl;
    }
    
    document.getElementById('lightboxTitle').textContent = gallery.title || 'Untitled';
    document.getElementById('lightboxDescription').textContent = gallery.description || '';
    document.getElementById('likeCount').textContent = gallery.likes || 0;
    
    // Check if user has liked this gallery
    if (currentUserData?.likedGalleries?.includes(gallery.id)) {
        likeBtn.classList.add('liked');
        likeBtn.querySelector('i').classList.remove('far');
        likeBtn.querySelector('i').classList.add('fas');
    } else {
        likeBtn.classList.remove('liked');
        likeBtn.querySelector('i').classList.remove('fas');
        likeBtn.querySelector('i').classList.add('far');
    }
    
    lightboxModal.classList.remove('hidden');
}

// Like/Unlike gallery
if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
        if (!selectedGallery) return;
        
        const isLiked = currentUserData?.likedGalleries?.includes(selectedGallery.id);
        
        try {
            if (isLiked) {
                // Unlike
                await updateDoc(doc(db, 'galleries', selectedGallery.id), {
                    likes: increment(-1)
                });
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    likedGalleries: arrayRemove(selectedGallery.id)
                });
                
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('i').classList.remove('fas');
                likeBtn.querySelector('i').classList.add('far');
                document.getElementById('likeCount').textContent = (selectedGallery.likes || 1) - 1;
                selectedGallery.likes = (selectedGallery.likes || 1) - 1;
            } else {
                // Like
                await updateDoc(doc(db, 'galleries', selectedGallery.id), {
                    likes: increment(1)
                });
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    likedGalleries: arrayUnion(selectedGallery.id)
                });
                
                likeBtn.classList.add('liked');
                likeBtn.querySelector('i').classList.remove('far');
                likeBtn.querySelector('i').classList.add('fas');
                document.getElementById('likeCount').textContent = (selectedGallery.likes || 0) + 1;
                selectedGallery.likes = (selectedGallery.likes || 0) + 1;
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    });
}

// Download media
if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
        if (!selectedGallery) return;
        
        try {
            let mediaUrl = selectedGallery.url;
            if (selectedGallery.storagePath) {
                const storageRef = ref(storage, selectedGallery.storagePath);
                mediaUrl = await getDownloadURL(storageRef);
            }
            
            // Increment download count
            await updateDoc(doc(db, 'galleries', selectedGallery.id), {
                downloads: increment(1)
            });
            
            // Create download link
            const a = document.createElement('a');
            a.href = mediaUrl;
            a.download = selectedGallery.title || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
        } catch (error) {
            console.error('Error downloading:', error);
            alert('Error downloading file');
        }
    });
}

// Share media
if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
        if (!selectedGallery) return;
        
        const shareData = {
            title: selectedGallery.title || 'Check out this gallery!',
            text: selectedGallery.description || '',
            url: window.location.href
        };
        
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    });
}

// Subscribe button in premium modal
if (subscribeBtn) {
    subscribeBtn.addEventListener('click', () => {
        premiumModal.classList.add('hidden');
        // Redirect to subscription page
        window.location.href = '/pages/subscription.html';
    });
}

// Close modals
if (closePremiumModal) {
    closePremiumModal.addEventListener('click', () => {
        premiumModal.classList.add('hidden');
    });
}

document.querySelector('.close-lightbox')?.addEventListener('click', () => {
    lightboxModal.classList.add('hidden');
    const videoEl = document.getElementById('lightboxVideo');
    videoEl.pause();
    videoEl.src = '';
});

// Filter galleries
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        galleries = [];
        lastDoc = null;
        hasMore = true;
        loadGalleries();
    });
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === premiumModal) {
        premiumModal.classList.add('hidden');
    }
    if (e.target === lightboxModal) {
        lightboxModal.classList.add('hidden');
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = '../index.html';
});
