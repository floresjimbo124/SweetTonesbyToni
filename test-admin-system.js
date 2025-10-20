const http = require('http');
const https = require('https');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'sweetsbytoni2024';

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Test functions
async function testServerStartup() {
  console.log('🧪 Testing server startup...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    
    if (response.status === 200) {
      console.log('✅ Server is running and responding');
      return true;
    } else {
      console.log(`❌ Server returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Server is not responding:', error.message);
    return false;
  }
}

async function testAdminLogin() {
  console.log('\n🧪 Testing admin login...');
  
  // Test with correct credentials
  console.log('Testing with correct credentials...');
  try {
    const loginData = JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    });
    
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Admin login successful with correct credentials');
      return response.data.token;
    } else {
      console.log('❌ Admin login failed with correct credentials:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Admin login request failed:', error.message);
    return null;
  }
}

async function testInvalidLogin() {
  console.log('\n🧪 Testing invalid login...');
  
  try {
    const loginData = JSON.stringify({
      username: 'wrong',
      password: 'wrong'
    });
    
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    if (response.status === 401) {
      console.log('✅ Invalid credentials correctly rejected');
      return true;
    } else {
      console.log('❌ Invalid credentials should be rejected:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ Invalid login test failed:', error.message);
    return false;
  }
}

async function testProtectedRoutes(token) {
  console.log('\n🧪 Testing protected routes...');
  
  if (!token) {
    console.log('❌ No token available for testing protected routes');
    return false;
  }
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/orders',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Protected route accessible with valid token');
      console.log(`📊 Found ${response.data.length} orders`);
      return true;
    } else {
      console.log('❌ Protected route failed:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ Protected route test failed:', error.message);
    return false;
  }
}

async function testUnauthorizedAccess() {
  console.log('\n🧪 Testing unauthorized access...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/orders',
      method: 'GET'
    });
    
    if (response.status === 401) {
      console.log('✅ Unauthorized access correctly blocked');
      return true;
    } else {
      console.log('❌ Unauthorized access should be blocked:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ Unauthorized access test failed:', error.message);
    return false;
  }
}

async function testOrderStatusUpdate(token) {
  console.log('\n🧪 Testing order status update...');
  
  if (!token) {
    console.log('❌ No token available for testing order updates');
    return false;
  }
  
  // First get orders to find one to update
  try {
    const ordersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/orders',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (ordersResponse.status === 200 && ordersResponse.data.length > 0) {
      const firstOrder = ordersResponse.data[0];
      console.log(`Testing status update for order ${firstOrder.id}`);
      
      const updateData = JSON.stringify({
        status: 'confirmed'
      });
      
      const updateResponse = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/admin/orders/${firstOrder.id}`,
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(updateData)
        }
      }, updateData);
      
      if (updateResponse.status === 200) {
        console.log('✅ Order status update successful');
        return true;
      } else {
        console.log('❌ Order status update failed:', updateResponse);
        return false;
      }
    } else {
      console.log('⚠️ No orders found to test status update');
      return true; // Not a failure, just no data
    }
  } catch (error) {
    console.log('❌ Order status update test failed:', error.message);
    return false;
  }
}

async function testOrderLookup() {
  console.log('\n🧪 Testing public order lookup...');
  
  try {
    // Test with a non-existent order ID
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/orders/NONEXISTENT123',
      method: 'GET'
    });
    
    if (response.status === 404) {
      console.log('✅ Non-existent order correctly returns 404');
      return true;
    } else {
      console.log('❌ Non-existent order should return 404:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ Order lookup test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🍰 Starting Admin System Tests for Sweets by Toni\n');
  console.log('=' .repeat(60));
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Server startup
  totalTests++;
  if (await testServerStartup()) passedTests++;
  
  // Test 2: Invalid login
  totalTests++;
  if (await testInvalidLogin()) passedTests++;
  
  // Test 3: Valid admin login
  totalTests++;
  const token = await testAdminLogin();
  if (token) passedTests++;
  
  // Test 4: Unauthorized access
  totalTests++;
  if (await testUnauthorizedAccess()) passedTests++;
  
  // Test 5: Protected routes with valid token
  totalTests++;
  if (await testProtectedRoutes(token)) passedTests++;
  
  // Test 6: Order status update
  totalTests++;
  if (await testOrderStatusUpdate(token)) passedTests++;
  
  // Test 7: Public order lookup
  totalTests++;
  if (await testOrderLookup()) passedTests++;
  
  console.log('\n' + '=' .repeat(60));
  console.log(`🏁 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Admin system is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the server and configuration.');
  }
  
  console.log('\n📋 Manual Testing Checklist:');
  console.log('1. Open http://localhost:3000/admin-login.html');
  console.log('2. Test login with: admin / sweetsbytoni2024');
  console.log('3. Verify redirect to admin dashboard');
  console.log('4. Test order filtering by status');
  console.log('5. Test viewing order details');
  console.log('6. Test logout functionality');
  console.log('7. Verify statistics display correctly');
}

// Run the tests
runTests().catch(console.error);
