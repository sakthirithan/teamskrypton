
-- Drop the overly permissive policy and create a more targeted one
DROP POLICY IF EXISTS "Anyone can submit registration request" ON public.registration_requests;

-- Create policy that allows insert but with email validation constraint
CREATE POLICY "Anyone can submit registration request with valid email"
  ON public.registration_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (email LIKE '%@bitsathy.ac.in');
