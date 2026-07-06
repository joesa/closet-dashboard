-- Grant admin privileges to yawkyeinketia@hotmail.com
-- First ensure a profile row exists (in case they haven't signed in yet),
-- then flip is_admin = true.

-- If user already exists in auth.users and profiles, just update.
update public.profiles
   set is_admin = true,
       updated_at = now()
 where lower(email) = 'yawkyeinketia@hotmail.com';
