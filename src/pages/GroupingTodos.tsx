import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { GlobalTodoPanel } from '@/components/grouping/GlobalTodoPanel';

const GroupingTodos = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth');
  }, [user, isLoading, navigate]);

  if (isLoading || !user) return null;

  return (
    <GroupingLayout title="To-Do List">
      <div className="w-full h-full flex flex-col">
        <GlobalTodoPanel mode="grouping" />
      </div>
    </GroupingLayout>
  );
};

export default GroupingTodos;
