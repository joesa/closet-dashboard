const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.5,
    maxOutputTokens: 1024,
  },
});
const prompt = `A contractor is filling out a form to build their marketing website and must choose their "ideal customer" from a dropdown menu.
Based on their industry and services, suggest 4-5 short, specific ideal-customer segment labels (2-5 words each) that someone in this exact trade would actually recognize and pick from. Avoid generic filler — tailor to the trade (e.g. a towing company's segments differ completely from a custom closet company's).
Always include one broad catch-all option worded close to "A mix of everyone".
Return JSON only, no markdown: { "options": string[] }

Industry: food-truck
Services offered: Food Truck Booking
`;
model.generateContent(prompt).then(r => {
  const t = r.response.text();
  console.log("Raw:", t);
}).catch(e => console.error("ERR", e));
