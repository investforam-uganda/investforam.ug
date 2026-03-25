import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Check auth state and update UI
onAuthStateChanged(auth, (user) => {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const dashboardLink = document.getElementById('dashboardLink');
    
    if (user && authButtons && userMenu) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        
        // Get user name
        const userRef = doc(db, "users", user.uid);
        getDoc(userRef).then((docSnap) => {
            if (docSnap.exists()) {
                const userName = document.getElementById('userName');
                if (userName) {
                    userName.textContent = `Welcome, ${docSnap.data().fullName.split(' ')[0]}`;
                }
            }
        });
        
        if (dashboardLink) {
            dashboardLink.style.display = 'block';
        }
    } else if (authButtons && userMenu) {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
        if (dashboardLink) {
            dashboardLink.style.display = 'none';
        }
    }
});

// Handle invest buttons on homepage
document.addEventListener('DOMContentLoaded', () => {
    const investBtns = document.querySelectorAll('.invest-btn');
    
    investBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const plan = btn.getAttribute('data-plan');
            const minAmount = btn.getAttribute('data-min');
            
            if (auth.currentUser) {
                window.location.href = `dashboard.html?plan=${encodeURIComponent(plan)}&min=${minAmount}`;
            } else {
                if (confirm('Please login to invest. Go to login page?')) {
                    window.location.href = 'login.html';
                }
            }
        });
    });
});

// Logout function
window.logout = async function() {
    import('./auth.js').then(module => {
        module.logout();
    });
};

