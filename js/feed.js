import { auth, db } from './firebase-init.js';
import { 
    collection, query, where, orderBy, limit, getDocs, 
    doc, getDoc, updateDoc, addDoc, increment, serverTimestamp,
    onSnapshot, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// State
let currentUser = null;
let currentUserData = null;
let posts = [];

// DOM Elements
const feedPosts = document.getElementById('feedPosts');
const storiesList = document.getElementById('storiesList');

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        loadFeed();
        loadStories();
        
        // Update UI
        document.getElementById('userName').textContent = currentUserData?.name || currentUser.email;
        if (currentUserData?.profileImage) {
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

// Load feed posts
async function loadFeed() {
    try {
        // Get posts from followed models and popular content
        const q = query(
            collection(db, 'galleries'),
            orderBy('createdAt', 'desc'),
            limit(30)
        );
        
        const querySnapshot = await getDocs(q);
        posts = [];
        
        querySnapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() });
        });
        
        renderFeed();
        
        // Set up real-time listener for new posts
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const newPost = { id: change.doc.id, ...change.doc.data() };
                    posts.unshift(newPost);
                    renderFeed();
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading feed:', error);
        feedPosts.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading feed</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// Render feed posts
function renderFeed() {
    if (!feedPosts) return;
    
    if (posts.length === 0) {
        feedPosts.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <h3>No posts yet</h3>
                <p>Follow creators to see their content here!</p>
            </div>
        `;
        return;
    }
    
    feedPosts.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-user">
                    <img src="${post.modelProfileImage || 'https://via.placeholder.com/40'}" alt="${post.modelName}">
                    <div class="post-user-info">
                        <h4>${post.modelName || 'Creator'}</h4>
                        <p>${formatTimeAgo(post.createdAt)}</p>
                    </div>
                </div>
                <div class="post-menu">
                    <i class="fas fa-ellipsis-h"></i>
                </div>
            </div>
            
            <div class="post-media">
                ${post.mediaType === 'video' ? 
                    `<video src="${post.url}" controls poster="${post.thumbnail || ''}"></video>` :
                    `<img src="${post.url}" alt="${post.title}">`
                }
                ${post.isPremium && currentUserData?.subscriptionStatus !== 'active' ? 
                    '<div class="premium-overlay"><i class="fas fa-crown"></i> Premium Content</div>' : ''
                }
            </div>
            
            <div class="post-actions">
                <button class="action-button like-button" data-post-id="${post.id}">
                    <i class="far fa-heart"></i> <span class="like-count">${post.likes || 0}</span>
                </button>
                <button class="action-button comment-button">
                    <i class="far fa-comment"></i> <span>${post.comments || 0}</span>
                </button>
                <button class="action-button share-button">
                    <i class="far fa-share-square"></i>
                </button>
            </div>
            
            <div class="post-stats">
                <div class="post-likes">${post.likes || 0} likes</div>
                <div class="post-caption">
                    <strong>${post.modelName}</strong> ${post.title || ''}
                </div>
                <div class="post-time">${formatTimeAgo(post.createdAt)}</div>
            </div>
            
            <div class="comment-section">
                <div class="comments-list" id="comments-${post.id}">
                    <!-- Comments will be loaded here -->
                </div>
                <div class="comment-input">
                    <input type="text" placeholder="Add a comment..." id="comment-input-${post.id}">
                    <button onclick="addComment('${post.id}')">Post</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add event listeners for like buttons
    document.querySelectorAll('.like-button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const postId = btn.dataset.postId;
            await toggleLike(postId, btn);
        });
    });
    
    // Load comments for each post
    posts.forEach(post => {
        loadComments(post.id);
    });
}

// Toggle like on post
async function toggleLike(postId, buttonElement) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    const isLiked = currentUserData?.likedPosts?.includes(postId);
    const likeCountSpan = buttonElement.querySelector('.like-count');
    const heartIcon = buttonElement.querySelector('i');
    
    try {
        if (isLiked) {
            // Unlike
            await updateDoc(doc(db, 'galleries', postId), {
                likes: increment(-1)
            });
            await updateDoc(doc(db, 'users', currentUser.uid), {
                likedPosts: arrayRemove(postId)
            });
            
            likeCountSpan.textContent = (post.likes || 1) - 1;
            heartIcon.classList.remove('fas');
            heartIcon.classList.add('far');
            buttonElement.classList.remove('liked');
            post.likes = (post.likes || 1) - 1;
        } else {
            // Like
            await updateDoc(doc(db, 'galleries', postId), {
                likes: increment(1)
            });
            await updateDoc(doc(db, 'users', currentUser.uid), {
                likedPosts: arrayUnion(postId)
            });
            
            likeCountSpan.textContent = (post.likes || 0) + 1;
            heartIcon.classList.remove('far');
            heartIcon.classList.add('fas');
            buttonElement.classList.add('liked');
            post.likes = (post.likes || 0) + 1;
        }
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

// Add comment to post
window.addComment = async function(postId) {
    const commentInput = document.getElementById(`comment-input-${postId}`);
    const commentText = commentInput.value.trim();
    
    if (!commentText) return;
    
    try {
        await addDoc(collection(db, 'galleries', postId, 'comments'), {
            userId: currentUser.uid,
            userName: currentUserData?.name || currentUser.email,
            userAvatar: currentUserData?.profileImage || '',
            text: commentText,
            createdAt: serverTimestamp()
        });
        
        // Increment comment count on post
        await updateDoc(doc(db, 'galleries', postId), {
            comments: increment(1)
        });
        
        commentInput.value = '';
        loadComments(postId);
        
    } catch (error) {
        console.error('Error adding comment:', error);
    }
};

// Load comments for a post
async function loadComments(postId) {
    const commentsContainer = document.getElementById(`comments-${postId}`);
    if (!commentsContainer) return;
    
    try {
        const q = query(
            collection(db, 'galleries', postId, 'comments'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        const comments = [];
        
        querySnapshot.forEach((doc) => {
            comments.push({ id: doc.id, ...doc.data() });
        });
        
        if (comments.length === 0) {
            commentsContainer.innerHTML = '<div class="no-comments">No comments yet. Be the first!</div>';
            return;
        }
        
        commentsContainer.innerHTML = comments.map(comment => `
            <div class="comment">
                <strong>${comment.userName}</strong> ${comment.text}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Load stories
async function loadStories() {
    try {
        // Get recent stories from followed models
        const q = query(
            collection(db, 'stories'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            storiesList.innerHTML = '';
            return;
        }
        
        storiesList.innerHTML = querySnapshot.docs.map(doc => {
            const story = doc.data();
            return `
                <div class="story-item" onclick="viewStory('${doc.id}')">
                    <img src="${story.userAvatar || 'https://via.placeholder.com/70'}" alt="${story.userName}">
                    <span>${story.userName}</span>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading stories:', error);
    }
}

// Helper: Format time ago
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
}
