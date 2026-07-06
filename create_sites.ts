import { provisionTenant } from './src/lib/provision/provisionTenant';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Provisioning site 1...");
  try {
    const res1 = await provisionTenant({
      businessName: "Alpha Random Test",
      theme: "warm-handyman",
      subdomain: "alpha-random-" + Date.now(),
      ownerEmail: "alpha" + Date.now() + "@test.com",
      heroHeadline: "Alpha Random Services",
      aboutDescription: "We do alpha things.",
      heroImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158",
      services: ["Alpha Service", "Construction"],
      intakeSetup: { vibe: "industrial", serviceArea: "New York", addressLocality: "New York", answers: ["Concrete", "Epoxy"] } as any,
      mode: "full",
      siteStatus: "active",
      loginOrigin: "http://localhost:3001",
      sendWelcomeEmail: false,
    });
    console.log("Site 1 URL:", res1.url);
  } catch (e) {
    console.error("Error 1:", e);
  }

  console.log("Provisioning site 2...");
  try {
    const res2 = await provisionTenant({
      businessName: "Beta Random Test",
      theme: "clean-contractor",
      subdomain: "beta-random-" + Date.now(),
      ownerEmail: "beta" + Date.now() + "@test.com",
      heroHeadline: "Beta Random Services",
      aboutDescription: "We do beta things.",
      heroImage: "https://images.unsplash.com/photo-1504307651254-35680f356f27",
      services: ["Beta Service", "Landscaping"],
      intakeSetup: { vibe: "elegant", serviceArea: "Denver", addressLocality: "Denver", answers: ["Hardscaping", "Patios"] } as any,
      mode: "full",
      siteStatus: "active",
      loginOrigin: "http://localhost:3001",
      sendWelcomeEmail: false,
    });
    console.log("Site 2 URL:", res2.url);
  } catch (e) {
    console.error("Error 2:", e);
  }
}

run();
