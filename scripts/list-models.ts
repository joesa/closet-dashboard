import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No API key");
  
  // Since GoogleGenerativeAI SDK doesn't expose listModels directly easily in all versions, 
  // let's just fetch it.
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  console.log(data.models.map((m: any) => m.name).join('\n'));
}
run().catch(console.error);
