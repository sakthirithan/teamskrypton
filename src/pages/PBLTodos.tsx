import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { GlobalTodoPanel } from '@/components/grouping/GlobalTodoPanel';

const PBLTodos = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth');
  }, [user, isLoading, navigate]);

  if (isLoading || !user) return null;

  return (
    <PBLLayout title="To-Do List">
      <div className="w-full h-full flex flex-col">
        <GlobalTodoPanel mode="pbl" />
      </div>
    </PBLLayout>
  );
};

export default PBLTodos;
