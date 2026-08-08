async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No API key");
  
  // Since GoogleGenerativeAI SDK doesn't expose listModels directly easily in all versions, 
  // let's just fetch it.
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = (await res.json()) as { models?: Array<{ name?: string }> };
  console.log((data.models ?? []).map((model) => model.name).filter(Boolean).join('\n'));
}
run().catch(console.error);
