document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const messageDiv = document.getElementById('message');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      messageDiv.innerHTML = '<div class="alert alert-success">Login successful! Redirecting...</div>';
      
      // Redirect based on role
      setTimeout(() => {
        if (data.user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/dashboard';
        }
      }, 1000);
    } else {
      messageDiv.innerHTML = `<div class="alert alert-error">${data.error}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = '<div class="alert alert-error">Login failed. Please try again.</div>';
    console.error('Error:', error);
  }
});
