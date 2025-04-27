// auth.js

// State variables
let token = localStorage.getItem('token') || "";
let user = "";
let isLoading = true;

// Authorization header
const getAuthorizationToken = () => `Bearer ${token}`;

// Store token in localStorage
function storeTokenInLS(serverToken) {
    token = serverToken;
    localStorage.setItem('token', serverToken);
}

// Check if user is logged in
function isLoggedIn() {
    return !!token;
}

// Logout functionality
function logoutUser() {
    token = "";
    localStorage.removeItem("token");
}

// Fetch user data with token authentication
async function userAuthentication() {
    if (!token) return;

    isLoading = true;
    try {
        const response = await fetch('http://localhost:3000/api/auth/user', {
            method: 'GET',
            headers: {
                Authorization: getAuthorizationToken(),
            },
        });

        if (response.ok) {
            const data = await response.json();
            console.log("User data:", data.userData);
            user = data.userData;
        } else {
            logoutUser();
            console.error("Error fetching user data");
        }
    } catch (error) {
        console.error("Error in authentication:", error);
        logoutUser();
    } finally {
        isLoading = false;
    }
}



// Call initialize on page load
window.addEventListener('DOMContentLoaded', initializeApp);

// Expose functions globally if needed
window.auth = {
    storeTokenInLS,
    logoutUser,
    isLoggedIn,
    getAuthorizationToken,
    userAuthentication,
    initializeApp,
};
