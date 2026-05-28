-- =============================================================================
-- Scraper helper geo catalog: US states with mapped city lists
-- =============================================================================

create table if not exists public.scraper_us_state_catalog (
  state_code   text primary key,
  state_name   text not null unique,
  cities       jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists scraper_us_state_catalog_name_idx
  on public.scraper_us_state_catalog (state_name);

alter table public.scraper_us_state_catalog enable row level security;

drop policy if exists "scraper_us_state_catalog_admin_read" on public.scraper_us_state_catalog;
create policy "scraper_us_state_catalog_admin_read"
  on public.scraper_us_state_catalog for select
  using (public.is_admin());

insert into public.scraper_us_state_catalog (state_code, state_name, cities)
values
  ('AL', 'Alabama', '["Birmingham","Montgomery","Mobile","Huntsville","Tuscaloosa"]'::jsonb),
  ('AK', 'Alaska', '["Anchorage","Fairbanks","Juneau","Wasilla","Sitka"]'::jsonb),
  ('AZ', 'Arizona', '["Phoenix","Tucson","Mesa","Chandler","Scottsdale"]'::jsonb),
  ('AR', 'Arkansas', '["Little Rock","Fayetteville","Fort Smith","Springdale","Jonesboro"]'::jsonb),
  ('CA', 'California', '["Los Angeles","San Diego","San Jose","San Francisco","Sacramento"]'::jsonb),
  ('CO', 'Colorado', '["Denver","Colorado Springs","Aurora","Fort Collins","Boulder"]'::jsonb),
  ('CT', 'Connecticut', '["Bridgeport","New Haven","Stamford","Hartford","Waterbury"]'::jsonb),
  ('DE', 'Delaware', '["Wilmington","Dover","Newark","Middletown","Smyrna"]'::jsonb),
  ('FL', 'Florida', '["Jacksonville","Miami","Tampa","Orlando","St. Petersburg"]'::jsonb),
  ('GA', 'Georgia', '["Atlanta","Augusta","Columbus","Savannah","Athens"]'::jsonb),
  ('HI', 'Hawaii', '["Honolulu","Hilo","Kailua","Pearl City","Waipahu"]'::jsonb),
  ('ID', 'Idaho', '["Boise","Meridian","Nampa","Idaho Falls","Pocatello"]'::jsonb),
  ('IL', 'Illinois', '["Chicago","Aurora","Naperville","Joliet","Rockford"]'::jsonb),
  ('IN', 'Indiana', '["Indianapolis","Fort Wayne","Evansville","South Bend","Carmel"]'::jsonb),
  ('IA', 'Iowa', '["Des Moines","Cedar Rapids","Davenport","Sioux City","Iowa City"]'::jsonb),
  ('KS', 'Kansas', '["Wichita","Overland Park","Kansas City","Olathe","Topeka"]'::jsonb),
  ('KY', 'Kentucky', '["Louisville","Lexington","Bowling Green","Owensboro","Covington"]'::jsonb),
  ('LA', 'Louisiana', '["New Orleans","Baton Rouge","Shreveport","Lafayette","Lake Charles"]'::jsonb),
  ('ME', 'Maine', '["Portland","Lewiston","Bangor","South Portland","Auburn"]'::jsonb),
  ('MD', 'Maryland', '["Baltimore","Frederick","Rockville","Gaithersburg","Annapolis"]'::jsonb),
  ('MA', 'Massachusetts', '["Boston","Worcester","Springfield","Cambridge","Lowell"]'::jsonb),
  ('MI', 'Michigan', '["Detroit","Grand Rapids","Warren","Sterling Heights","Ann Arbor"]'::jsonb),
  ('MN', 'Minnesota', '["Minneapolis","St. Paul","Rochester","Duluth","Bloomington"]'::jsonb),
  ('MS', 'Mississippi', '["Jackson","Gulfport","Southaven","Hattiesburg","Biloxi"]'::jsonb),
  ('MO', 'Missouri', '["Kansas City","St. Louis","Springfield","Columbia","Independence"]'::jsonb),
  ('MT', 'Montana', '["Billings","Missoula","Great Falls","Bozeman","Butte"]'::jsonb),
  ('NE', 'Nebraska', '["Omaha","Lincoln","Bellevue","Grand Island","Kearney"]'::jsonb),
  ('NV', 'Nevada', '["Las Vegas","Henderson","Reno","North Las Vegas","Sparks"]'::jsonb),
  ('NH', 'New Hampshire', '["Manchester","Nashua","Concord","Derry","Dover"]'::jsonb),
  ('NJ', 'New Jersey', '["Newark","Jersey City","Paterson","Elizabeth","Edison"]'::jsonb),
  ('NM', 'New Mexico', '["Albuquerque","Las Cruces","Rio Rancho","Santa Fe","Roswell"]'::jsonb),
  ('NY', 'New York', '["New York","Buffalo","Rochester","Yonkers","Syracuse"]'::jsonb),
  ('NC', 'North Carolina', '["Charlotte","Raleigh","Greensboro","Durham","Winston-Salem"]'::jsonb),
  ('ND', 'North Dakota', '["Fargo","Bismarck","Grand Forks","Minot","West Fargo"]'::jsonb),
  ('OH', 'Ohio', '["Columbus","Cleveland","Cincinnati","Toledo","Akron"]'::jsonb),
  ('OK', 'Oklahoma', '["Oklahoma City","Tulsa","Norman","Broken Arrow","Edmond"]'::jsonb),
  ('OR', 'Oregon', '["Portland","Eugene","Salem","Gresham","Hillsboro"]'::jsonb),
  ('PA', 'Pennsylvania', '["Philadelphia","Pittsburgh","Allentown","Erie","Reading"]'::jsonb),
  ('RI', 'Rhode Island', '["Providence","Warwick","Cranston","Pawtucket","East Providence"]'::jsonb),
  ('SC', 'South Carolina', '["Charleston","Columbia","North Charleston","Mount Pleasant","Rock Hill"]'::jsonb),
  ('SD', 'South Dakota', '["Sioux Falls","Rapid City","Aberdeen","Brookings","Watertown"]'::jsonb),
  ('TN', 'Tennessee', '["Nashville","Memphis","Knoxville","Chattanooga","Clarksville"]'::jsonb),
  ('TX', 'Texas', '["Houston","San Antonio","Dallas","Austin","Fort Worth"]'::jsonb),
  ('UT', 'Utah', '["Salt Lake City","West Valley City","Provo","West Jordan","Orem"]'::jsonb),
  ('VT', 'Vermont', '["Burlington","South Burlington","Rutland","Barre","Montpelier"]'::jsonb),
  ('VA', 'Virginia', '["Virginia Beach","Norfolk","Chesapeake","Richmond","Arlington"]'::jsonb),
  ('WA', 'Washington', '["Seattle","Spokane","Tacoma","Vancouver","Bellevue"]'::jsonb),
  ('WV', 'West Virginia', '["Charleston","Huntington","Morgantown","Parkersburg","Wheeling"]'::jsonb),
  ('WI', 'Wisconsin', '["Milwaukee","Madison","Green Bay","Kenosha","Racine"]'::jsonb),
  ('WY', 'Wyoming', '["Cheyenne","Casper","Laramie","Gillette","Rock Springs"]'::jsonb)
on conflict (state_code) do update
set state_name = excluded.state_name,
    cities = excluded.cities,
    updated_at = now();
