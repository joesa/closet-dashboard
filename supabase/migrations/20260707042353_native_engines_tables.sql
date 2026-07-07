-- Services offered for booking (massage, dental, fitness, etc.)
CREATE TABLE service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES contractor_settings(id),
  name text NOT NULL,
  description text,
  duration_minutes int,
  price_cents int NOT NULL DEFAULT 0,
  tier text DEFAULT 'standard',
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Contractor availability windows (weekly recurring)
CREATE TABLE booking_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES contractor_settings(id),
  day_of_week int NOT NULL,       -- 0=Sun ... 6=Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes int DEFAULT 60
);

-- Customer bookings
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES contractor_settings(id),
  service_id uuid REFERENCES service_catalog(id),
  service_name text NOT NULL,
  service_price_cents int,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Ticket events
CREATE TABLE ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES contractor_settings(id),
  name text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time time,
  venue text,
  capacity int,
  price_cents int NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Ticket purchases
CREATE TABLE ticket_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES contractor_settings(id),
  event_id uuid REFERENCES ticket_events(id),
  event_name text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  quantity int NOT NULL DEFAULT 1,
  total_cents int NOT NULL DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
