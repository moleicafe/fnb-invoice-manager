import { createClient } from '@/lib/supabase/server';
import { UploadFlow } from './UploadFlow';

export default async function UploadPage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: { user } }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('active', true).order('name'),
    supabase.auth.getUser(),
  ]);
  const { data: profile } = await supabase
    .from('profiles')
    .select('home_location_id')
    .eq('user_id', user!.id)
    .single();

  return (
    <UploadFlow
      locations={locations ?? []}
      defaultLocationId={profile?.home_location_id ?? locations?.[0]?.id ?? ''}
    />
  );
}
