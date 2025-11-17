document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
    full_name: document.getElementById('full_name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value
  };

  const messageDiv = document.getElementById('message');

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      messageDiv.innerHTML = '<div class="alert alert-success">Registration successful! Redirecting to login...</div>';
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else {
      messageDiv.innerHTML = `<div class="alert alert-error">${data.error}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = '<div class="alert alert-error">Registration failed. Please try again.</div>';
    console.error('Error:', error);
  }
});
