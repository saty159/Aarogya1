const axios = require('axios');

async function runTests() {
  const email = `testuser_${Date.now()}@example.com`;
  const password = 'Password123!';
  const name = 'Test User';

  console.log('--- Test 1: Register ---');
  try {
    const regRes = await axios.post('http://localhost:5000/api/auth/register', {
      email,
      password,
      name
    });
    console.log('Registration Success:', regRes.data);
    const token = regRes.data.token;

    console.log('\n--- Test 2: Login ---');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email,
      password
    });
    console.log('Login Success:', loginRes.data);

    console.log('\n--- Test 3: Analyze Text ---');
    const reportText = 'Haemoglobin: 11.2 g/dL\nWBC: 12,500 /μL\nBlood Glucose (Fasting): 145 mg/dL';
    const analyzeRes = await axios.post('http://localhost:5000/api/analyze', {
      text: reportText
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Analyze Success:', JSON.stringify(analyzeRes.data, null, 2));
    const reportId = analyzeRes.data.data.id;

    console.log('\n--- Test 4: Get History ---');
    const historyRes = await axios.get('http://localhost:5000/api/history', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Get History Success:', JSON.stringify(historyRes.data, null, 2));

    console.log('\n--- Test 5: Get Specific Report ---');
    const specificRes = await axios.get(`http://localhost:5000/api/history/${reportId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Get Specific Report Success:', JSON.stringify(specificRes.data, null, 2));

    console.log('\n--- Test 6: Delete Report ---');
    const deleteRes = await axios.delete(`http://localhost:5000/api/history/${reportId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Delete Report Success:', deleteRes.data);

    console.log('\n--- Test 7: Verify History Empty ---');
    const emptyHistRes = await axios.get('http://localhost:5000/api/history', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Empty History Success:', emptyHistRes.data.data.length === 0 ? 'Verified Empty!' : 'Failed (Not Empty)');

  } catch (error) {
    console.error('Test Failed:', error.response ? error.response.data : error.message);
  }
}

runTests();
