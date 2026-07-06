import { provisionTenant } from '../src/lib/provision/provisionTenant';

async function main() {
  console.log('Provisioning test order site...');
  const result = await provisionTenant({
    businessName: 'Gourmet Burger Truck',
    theme: 'gourmet-warm',
    layoutStyle: 'gallery-showcase',
    subdomain: 'burger-truck-3',
    ownerEmail: 'burgers@test.com',
    heroHeadline: 'Best Burgers in Town',
    aboutDescription: 'We serve fresh, hot, gourmet burgers on the go.',
    intakeSetup: {
      industry: 'Restaurants, Bars & Cafes',
      services: ['Full-Service Dining'],
      primary_cta: 'Order Online'
    },
    engagementModel: 'order',
    mode: 'full',
    siteStatus: 'active',
    loginOrigin: 'http://localhost:3001',
    sendWelcomeEmail: false,
  });

  console.log('Successfully provisioned:');
  console.log(result);
}

main().catch(console.error);
