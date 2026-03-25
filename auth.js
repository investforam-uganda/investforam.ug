import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Loading overlay functions
function showLoading(message = 'Processing...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-container">
                <div class="loader"></div>
                <div class="loader-text">${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        const loaderText = overlay.querySelector('.loader-text');
        if (loaderText) loaderText.textContent = message;
        overlay.style.display = 'flex';
    }
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
    }
}

// Show notification
function showNotification(title, message, type = 'success') {
    let toast = document.getElementById('notificationToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'notificationToast';
        toast.className = 'notification-toast';
        document.body.appendChild(toast);
    }
    
    const icon = type === 'success' ? '✅' : '❌';
    toast.className = `notification-toast ${type} show`;
    toast.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Check password strength
function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/\d/)) strength++;
    if (password.match(/[^a-zA-Z\d]/)) strength++;
    
    return {
        score: strength,
        text: ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][strength],
        color: ['#ef4444', '#f59e0b', '#fbbf24', '#10b981', '#059669'][strength]
    };
}

// Signup Function
window.signup = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('Signup function called');
    
    // Get form values
    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const countryCode = document.getElementById('countryCode')?.value;
    const phoneNumber = document.getElementById('phoneNumber')?.value.trim();
    const referralCode = document.getElementById('referralCode')?.value.trim();
    const termsCheckbox = document.getElementById('termsCheckbox');
    
    const errorDiv = document.getElementById('signupError');
    const successDiv = document.getElementById('signupSuccess');
    
    // Reset messages
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
    if (successDiv) {
        successDiv.style.display = 'none';
        successDiv.textContent = '';
    }
    
    // Validation
    if (!fullName) {
        if (errorDiv) {
            errorDiv.textContent = 'Please enter your full name';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Please enter your full name', 'error');
        return;
    }
    
    if (!email) {
        if (errorDiv) {
            errorDiv.textContent = 'Please enter your email address';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Please enter your email address', 'error');
        return;
    }
    
    if (!password) {
        if (errorDiv) {
            errorDiv.textContent = 'Please enter a password';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Please enter a password', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        if (errorDiv) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        if (errorDiv) {
            errorDiv.textContent = 'Password must be at least 6 characters';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Password must be at least 6 characters', 'error');
        return;
    }
    
    if (termsCheckbox && !termsCheckbox.checked) {
        if (errorDiv) {
            errorDiv.textContent = 'Please agree to the Terms of Service';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Please agree to the Terms of Service', 'error');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (errorDiv) {
            errorDiv.textContent = 'Please enter a valid email address';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Please enter a valid email address', 'error');
        return;
    }
    
    showLoading('Creating your account...');
    
    try {
        console.log('Attempting to create user with email:', email);
        
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('User created successfully:', user.uid);
        
        // Update profile with display name
        await updateProfile(user, { displayName: fullName });
        
        // Generate unique referral code
        const userReferralCode = fullName.substring(0, 3).toUpperCase() + 
                                 Math.random().toString(36).substring(2, 7).toUpperCase();
        
        // Save user data to Firestore
        const userData = {
            uid: user.uid,
            fullName: fullName,
            email: email,
            phone: `${countryCode || '+256'} ${phoneNumber || ''}`,
            referralCode: userReferralCode,
            referredBy: referralCode || null,
            totalInvested: 0,
            totalReturns: 0,
            activePlan: "None",
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            emailVerified: user.emailVerified,
            referrals: 0
        };
        
        await setDoc(doc(db, "users", user.uid), userData);
        console.log('User data saved to Firestore');
        
        // Process referral if exists
        if (referralCode) {
            try {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("referralCode", "==", referralCode.toUpperCase()));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const referrerDoc = querySnapshot.docs[0];
                    const referrerRef = doc(db, "users", referrerDoc.id);
                    const referrerData = referrerDoc.data();
                    await updateDoc(referrerRef, {
                        referrals: (referrerData.referrals || 0) + 1
                    });
                    console.log('Referral processed');
                }
            } catch (referralError) {
                console.error('Referral processing error:', referralError);
            }
        }
        
        hideLoading();
        showNotification('Success!', 'Account created successfully! Redirecting to dashboard...', 'success');
        
        if (successDiv) {
            successDiv.textContent = 'Account created successfully! Redirecting to dashboard...';
            successDiv.style.display = 'block';
        }
        
        // Clear form
        if (document.getElementById('signupForm')) {
            document.getElementById('signupForm').reset();
        }
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Signup error:', error);
        hideLoading();
        
        let errorMessage = error.message;
        
        // User-friendly error messages
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please login instead.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
        }
        
        if (errorDiv) {
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
        showNotification('Error', errorMessage, 'error');
    }
};

// Login Function
window.login = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('Login function called');
    
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
    
    if (!email) {
        if (errorDiv) {
            errorDiv.textContent = 'Please enter your email address';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Please enter your email address', 'error');
        return;
    }
    
    if (!password) {
        if (errorDiv) {
            errorDiv.textContent = 'Please enter your password';
            errorDiv.style.display = 'block';
        }
        showNotification('Error', 'Please enter your password', 'error');
        return;
    }
    
    showLoading('Signing in...');
    
    try {
        console.log('Attempting to login with email:', email);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Login successful:', user.uid);
        
        // Update last login
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            lastLogin: serverTimestamp()
        });
        
        hideLoading();
        showNotification('Welcome Back!', 'Login successful! Redirecting to dashboard...', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        hideLoading();
        
        let errorMessage = error.message;
        
        // User-friendly error messages
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please sign up first.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        }
        
        if (errorDiv) {
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
        showNotification('Login Failed', errorMessage, 'error');
    }
};

// Password Reset Function
window.resetPassword = async function(email) {
    if (!email) {
        showNotification('Error', 'Please enter your email address', 'error');
        return false;
    }
    
    showLoading('Sending reset email...');
    
    try {
        await sendPasswordResetEmail(auth, email);
        hideLoading();
        showNotification('Password Reset', 'Check your email for reset instructions', 'success');
        return true;
    } catch (error) {
        hideLoading();
        showNotification('Error', error.message, 'error');
        return false;
    }
};

// Logout Function
window.logout = async function() {
    showLoading('Logging out...');
    try {
        await signOut(auth);
        hideLoading();
        showNotification('Logged Out', 'You have been successfully logged out', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        hideLoading();
        showNotification('Error', 'Failed to logout. Please try again.', 'error');
    }
};

// Check if user is logged in
function checkAuth() {
    console.log('Checking authentication state...');
    
    auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        const dashboardLink = document.getElementById('dashboardLink');
        const userNameSpan = document.getElementById('userName');
        
        if (user && authButtons && userMenu) {
            // User is logged in
            if (authButtons) authButtons.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            
            // Get user name from Firestore
            try {
                const userRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(userRef);
                if (docSnap.exists() && userNameSpan) {
                    const firstName = docSnap.data().fullName.split(' ')[0];
                    userNameSpan.textContent = `Welcome, ${firstName}`;
                } else if (userNameSpan) {
                    userNameSpan.textContent = `Welcome, ${user.displayName || 'Investor'}`;
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                if (userNameSpan) {
                    userNameSpan.textContent = `Welcome, ${user.displayName || 'Investor'}`;
                }
            }
            
            if (dashboardLink) {
                dashboardLink.style.display = 'block';
            }
        } else if (authButtons && userMenu) {
            // User is logged out
            if (authButtons) authButtons.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
            if (dashboardLink) {
                dashboardLink.style.display = 'none';
            }
        }
        
        hideLoading();
    });
}

// Password strength checker for signup
function initPasswordStrength() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) return;
    
    // Check if strength meter already exists
    if (passwordInput.parentNode.querySelector('.password-strength')) return;
    
    const strengthDiv = document.createElement('div');
    strengthDiv.className = 'password-strength';
    const strengthBar = document.createElement('div');
    strengthBar.className = 'strength-bar';
    const strengthText = document.createElement('div');
    strengthText.className = 'strength-text';
    
    strengthDiv.appendChild(strengthBar);
    passwordInput.insertAdjacentElement('afterend', strengthDiv);
    strengthDiv.insertAdjacentElement('afterend', strengthText);
    
    passwordInput.addEventListener('input', (e) => {
        const strength = checkPasswordStrength(e.target.value);
        strengthBar.style.width = `${(strength.score + 1) * 20}%`;
        strengthBar.style.backgroundColor = strength.color;
        strengthText.textContent = `Password strength: ${strength.text}`;
        strengthText.style.color = strength.color;
    });
}

// Real-time validation
function initValidation() {
    const emailInput = document.getElementById('email');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordInput = document.getElementById('password');
    
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailInput.value && !emailRegex.test(emailInput.value)) {
                emailInput.classList.add('error');
                emailInput.classList.remove('success');
            } else if (emailInput.value) {
                emailInput.classList.remove('error');
                emailInput.classList.add('success');
            }
        });
    }
    
    if (confirmPasswordInput && passwordInput) {
        const validateConfirm = () => {
            if (confirmPasswordInput.value && confirmPasswordInput.value !== passwordInput.value) {
                confirmPasswordInput.classList.add('error');
                confirmPasswordInput.classList.remove('success');
            } else if (confirmPasswordInput.value) {
                confirmPasswordInput.classList.remove('error');
                confirmPasswordInput.classList.add('success');
            }
        };
        
        confirmPasswordInput.addEventListener('input', validateConfirm);
        passwordInput.addEventListener('input', validateConfirm);
    }
}

// Forgot password handler
function initForgotPassword() {
    const forgotLink = document.querySelector('.forgot-password');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email');
            const email = emailInput?.value;
            
            if (!email) {
                showNotification('Info', 'Please enter your email address first', 'success');
                if (emailInput) emailInput.focus();
                return;
            }
            
            await window.resetPassword(email);
        });
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing auth handlers...');
    
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        // Remove any existing submit handlers
        signupForm.removeEventListener('submit', window.signup);
        signupForm.addEventListener('submit', window.signup);
        initPasswordStrength();
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.removeEventListener('submit', window.login);
        loginForm.addEventListener('submit', window.login);
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.removeEventListener('click', window.logout);
        logoutBtn.addEventListener('click', window.logout);
    }
    
    initValidation();
    initForgotPassword();
    checkAuth();
});

export { auth, db };