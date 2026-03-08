import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { NotificationsPanel } from '@/components/pbl/NotificationsPanel';

const PBLNotifications = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth');
  }, [user, isLoading, navigate]);

  if (isLoading || !user) return null;

  return (
    <PBLLayout title="Notifications">
      <div className="max-w-3xl mx-auto">
        <NotificationsPanel userId={user.id} />
      </div>
    </PBLLayout>
  );
};

export default PBLNotifications;
