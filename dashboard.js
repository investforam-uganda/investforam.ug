import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, getDocs, addDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadDashboardData(user);
        await loadInvestmentHistory(user);
        await loadReferralCode(user);
    } else {
        window.location.href = 'login.html';
    }
});

// Load dashboard stats
async function loadDashboardData(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            const totalInvested = data.totalInvested || 0;
            const totalReturns = data.totalReturns || 0;
            const activePlan = data.activePlan || "None";
            
            document.getElementById('totalInvested').innerText = `$${totalInvested.toFixed(2)}`;
            document.getElementById('totalReturns').innerText = `$${totalReturns.toFixed(2)}`;
            document.getElementById('activePlan').innerText = activePlan;
            
            // Calculate ROI
            const roi = totalInvested > 0 ? (totalReturns / totalInvested * 100).toFixed(1) : 0;
            document.getElementById('roi').innerText = `${roi}%`;
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load investment history
async function loadInvestmentHistory(user) {
    try {
        const investmentsRef = collection(db, "users", user.uid, "investments");
        const q = query(investmentsRef, orderBy("date", "desc"), limit(10));
        const querySnap = await getDocs(q);
        
        const historyDiv = document.getElementById('investmentHistory');
        
        if (querySnap.empty) {
            historyDiv.innerHTML = '<p class="empty-state">No investments yet. Start investing above!</p>';
            return;
        }
        
        let html = '';
        querySnap.forEach((doc) => {
            const data = doc.data();
            const date = data.date?.toDate() || new Date();
            html += `
                <div class="investment-item">
                    <div>
                        <strong>$${data.amount}</strong> - ${data.plan}
                        <br>
                        <small>${date.toLocaleDateString()}</small>
                    </div>
                    <div>
                        <span class="badge">${data.expectedReturn}% return</span>
                    </div>
                </div>
            `;
        });
        
        historyDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Load referral code
async function loadReferralCode(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const referralCode = userSnap.data().referralCode;
            const referralDisplay = document.getElementById('referralCodeDisplay');
            if (referralDisplay) {
                referralDisplay.innerText = referralCode;
            }
        }
    } catch (error) {
        console.error('Error loading referral code:', error);
    }
}

// Make investment
async function makeInvestment() {
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    
    const amount = document.getElementById('investAmount').value;
    const plan = document.getElementById('investPlanSelect').value;
    const msgDiv = document.getElementById('investmentMsg');
    
    if (!amount || amount < 100) {
        msgDiv.innerHTML = '<div class="error-message">Minimum investment is UGX10,000</div>';
        return;
    }
    
    // Validate plan minimum
    if (plan === 'Growth Plan' && amount < 1000) {
        msgDiv.innerHTML = '<div class="error-message">Growth Plan requires minimum UGX100,000</div>';
        return;
    }
    
    if (plan === 'Premium Elite' && amount < 5000) {
        msgDiv.innerHTML = '<div class="error-message">Premium Elite requires minimum 200,000</div>';
        return;
    }
    
    // Calculate expected return percentage
    let expectedPercent = 8;
    if (plan === 'Growth Plan') expectedPercent = 20;
    if (plan === 'Premium Elite') expectedPercent = 25;
    
    const expectedReturn = (parseFloat(amount) * expectedPercent) / 100;
    
    try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const currentData = userSnap.data();
        
        const newTotalInvested = (currentData.totalInvested || 0) + parseFloat(amount);
        const newTotalReturns = (currentData.totalReturns || 0) + expectedReturn;
        
        // Update user stats
        await updateDoc(userRef, {
            totalInvested: newTotalInvested,
            totalReturns: newTotalReturns,
            activePlan: plan,
            lastInvestment: new Date()
        });
        
        // Save investment record
        const investmentsRef = collection(db, "users", currentUser.uid, "investments");
        await addDoc(investmentsRef, {
            amount: parseFloat(amount),
            plan: plan,
            expectedReturn: expectedPercent,
            status: 'active',
            date: new Date()
        });
        
        msgDiv.innerHTML = '<div class="success-message">✅ Investment successful! Returns will be calculated monthly.</div>';
        
        // Clear input and reload data
        document.getElementById('investAmount').value = '';
        await loadDashboardData(currentUser);
        await loadInvestmentHistory(currentUser);
        
        setTimeout(() => {
            msgDiv.innerHTML = '';
        }, 3000);
        
    } catch (error) {
        console.error('Investment error:', error);
        msgDiv.innerHTML = '<div class="error-message">Investment failed. Please try again.</div>';
    }
}

// Copy referral code
function copyReferralCode() {
    const codeElement = document.getElementById('referralCodeDisplay');
    const code = codeElement.innerText;
    
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copyReferralBtn');
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => {
            btn.innerText = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy code');
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const investBtn = document.getElementById('confirmInvestBtn');
    if (investBtn) {
        investBtn.addEventListener('click', makeInvestment);
    }
    
    const copyBtn = document.getElementById('copyReferralBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyReferralCode);
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await import('./auth.js').then(module => module.logout());
        });
    }
});

