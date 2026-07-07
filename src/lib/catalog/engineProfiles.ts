import type { IndustrySlug, EngineProfile } from './types'

export function getEngineProfile(slug: IndustrySlug): EngineProfile {
  // Booking Engines
  const bookingIndustries = [
    'medical-clinic', 'therapy-rehab', 'senior-care', 'beauty-salon', 'spa-wellness',
    'fitness-studio', 'massage-therapy', 'personal-training', 'tutoring', 'pet-services'
  ]
  
  if (bookingIndustries.includes(slug)) {
    return {
      engagementModel: 'booking',
      ctaVerb: 'Book Now',
      widgetSectionTitle: 'Book an Appointment',
      widgetSubtitle: 'Select a service and time to book your appointment.',
      dashboardLabel: 'Booking Engine',
      dashboardIcon: '📅',
      dashboardHelpText: 'Manage your services, set your weekly hours, and view upcoming appointments.',
      serviceDefaults: [
        {
          name: 'Standard Visit',
          unitLabel: 'per session',
          tiers: [
            { tier: 'basic', name: '30-min Session', priceHint: 75, description: 'Quick 30-minute session' },
            { tier: 'standard', name: '60-min Session', priceHint: 120, description: 'Standard 1-hour session', popular: true },
            { tier: 'premium', name: '90-min Session', priceHint: 165, description: 'Extended 90-minute session' }
          ]
        }
      ]
    }
  }

  // Order Engines
  const orderIndustries = [
    'restaurants-bars', 'food-truck', 'catering-chef'
  ]

  if (orderIndustries.includes(slug)) {
    return {
      engagementModel: 'order',
      ctaVerb: 'Order Online',
      widgetSectionTitle: 'Order Online',
      widgetSubtitle: 'Browse our menu and place your order.',
      dashboardLabel: 'Online Menu',
      dashboardIcon: '🛒',
      dashboardHelpText: 'Manage your menu items, categories, and view incoming orders.',
      serviceDefaults: [
        {
          name: 'Menu Item',
          unitLabel: 'per item',
          tiers: [
            { tier: 'standard', name: 'Standard', priceHint: 15, description: 'Delicious menu item' }
          ],
          addons: [
            { name: 'Extra Sauce', priceHint: 1 },
            { name: 'Make it a Combo', priceHint: 5 }
          ]
        }
      ]
    }
  }

  // Ticket Engines
  const ticketIndustries = [
    'dj-entertainment', 'bounce-house', 'limo-shuttle', 'event-rentals', 'tourism-travel',
    'recreation-entertainment', 'arts-culture'
  ]

  if (ticketIndustries.includes(slug)) {
    return {
      engagementModel: 'ticket',
      ctaVerb: 'Get Tickets',
      widgetSectionTitle: 'Get Tickets',
      widgetSubtitle: 'Select your event date and reserve your tickets.',
      dashboardLabel: 'Ticket System',
      dashboardIcon: '🎟️',
      dashboardHelpText: 'Create events, manage capacity, and track ticket sales.',
      serviceDefaults: [
        {
          name: 'Event Ticket',
          unitLabel: 'per ticket',
          tiers: [
            { tier: 'basic', name: 'General Admission', priceHint: 25, description: 'Standard entry ticket' },
            { tier: 'premium', name: 'VIP Access', priceHint: 75, description: 'Premium entry with perks' }
          ]
        }
      ]
    }
  }

  // Quote Engines (Cleaning specific)
  if (slug === 'cleaning') {
    return {
      engagementModel: 'quote',
      ctaVerb: 'Get a Free Quote',
      widgetSectionTitle: 'Get an Instant Quote',
      widgetSubtitle: 'Select your services and get a price estimate instantly.',
      dashboardLabel: 'Quote Calculator',
      dashboardIcon: '🧮',
      dashboardHelpText: 'Set your prices for each package. Customers will see these when requesting a quote.',
      serviceDefaults: [
        {
          name: 'House Cleaning',
          unitLabel: 'per visit',
          tiers: [
            { tier: 'basic', name: 'Basic Clean', priceHint: 120, description: '1-2 bedroom home, surface clean' },
            { tier: 'standard', name: 'Deep Clean', priceHint: 220, description: '3-4 bedroom, all rooms deep cleaned', popular: true },
            { tier: 'premium', name: 'Move-Out Clean', priceHint: 349, description: 'Full move-out or move-in clean' }
          ],
          addons: [
            { name: 'Inside Oven', priceHint: 35 },
            { name: 'Inside Fridge', priceHint: 25 },
            { name: 'Laundry (load)', priceHint: 20 }
          ]
        }
      ]
    }
  }

  // Quote Engines (Landscaping specific)
  if (slug === 'landscaping' || slug === 'tree-service') {
    return {
      engagementModel: 'quote',
      ctaVerb: 'Get a Free Quote',
      widgetSectionTitle: 'Get an Instant Quote',
      widgetSubtitle: 'Select your services and get a price estimate instantly.',
      dashboardLabel: 'Quote Calculator',
      dashboardIcon: '🧮',
      dashboardHelpText: 'Set your prices for each package. Customers will see these when requesting a quote.',
      serviceDefaults: [
        {
          name: 'Yard Maintenance',
          unitLabel: 'per visit',
          tiers: [
            { tier: 'basic', name: 'Basic Mow', priceHint: 45, description: 'Mow, edge, and blow' },
            { tier: 'standard', name: 'Full Service', priceHint: 85, description: 'Mow, edge, blow, and weed control', popular: true },
            { tier: 'premium', name: 'Premium Care', priceHint: 150, description: 'Full service plus pruning and fertilizing' }
          ]
        }
      ]
    }
  }

  // Quote Engines (Default Trades)
  return {
    engagementModel: 'quote',
    ctaVerb: 'Get a Free Quote',
    widgetSectionTitle: 'Get an Instant Quote',
    widgetSubtitle: 'Select your services and get a price estimate instantly.',
    dashboardLabel: 'Quote Calculator',
    dashboardIcon: '🧮',
    dashboardHelpText: 'Set your prices for each job type. Customers will see these when requesting a quote.',
    serviceDefaults: [
      {
        name: 'Service Call',
        unitLabel: 'per job',
        tiers: [
          { tier: 'basic', name: 'Diagnostic', priceHint: 89, description: 'Initial diagnosis and trip charge' },
          { tier: 'standard', name: 'Standard Repair', priceHint: 249, description: 'Common repair with standard parts', popular: true },
          { tier: 'premium', name: 'Full Install', priceHint: 1200, description: 'Complete system replacement or install' }
        ]
      }
    ]
  }
}
