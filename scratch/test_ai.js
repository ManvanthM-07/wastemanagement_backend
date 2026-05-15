const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '../wastemanagement_backend/.env' });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.replace(/['"]+/g, '').trim() : null;
    if (!apiKey) {
        console.error("No API key found");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const models = await genAI.listModels();
        console.log("Available models:");
        console.log(JSON.stringify(models, null, 2));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
