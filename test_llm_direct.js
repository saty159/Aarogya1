const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `You are Aarogya, a high-precision AI medical assistant. Your task is to extract and interpret medical reports and prescriptions with 100% accuracy.`;

async function testGemini(modelName) {
  console.log(`--- Testing Gemini: ${modelName} ---`);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: `Analyze this medical report:\n\nHaemoglobin: 11.2 g/dL` }] }],
      generationConfig: { responseMimeType: "application/json" }
    };
    const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    console.log(`${modelName} Success! Response sample:`, JSON.stringify(response.data.candidates?.[0]?.content?.parts?.[0]?.text).substring(0, 100));
  } catch (error) {
    console.error(`${modelName} Failed:`, error.message);
    if (error.response) {
      console.error('Error Body:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testGroq() {
  console.log('\n--- Testing Groq: llama-3.3-70b-versatile ---');
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this medical report:\n\nHaemoglobin: 11.2 g/dL` }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Groq Success! Response sample:', response.data.choices?.[0]?.message?.content?.substring(0, 100));
  } catch (error) {
    console.error('Groq Failed:', error.message);
    if (error.response) {
      console.error('Error Body:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function run() {
  await testGemini('gemini-flash-latest');
  await testGemini('gemini-2.5-flash');
  await testGemini('gemini-3.5-flash');
  await testGroq();
}
run();
