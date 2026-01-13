import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { KryptonRole, TaskStatus, LEADERSHIP_ROLES } from '@/lib/constants';
import { Users } from 'lucide-react';

interface TeamMember {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    department: string;
    avatar_url: string | null;
    current_status: TaskStatus | null;
    created_at: string;
  };
  role: KryptonRole | null;
}

const Team = () => {
  const { user, isLoading, isCaptainOrVice } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const fetchMembers = async () => {
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      // Fetch roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (profiles) {
        const roleMap = new Map(roles?.map(r => [r.user_id, r.role as KryptonRole]) || []);
        const teamMembers: TeamMember[] = profiles.map(p => ({
          profile: {
            user_id: p.user_id,
            full_name: p.full_name,
            email: p.email,
            department: p.department,
            avatar_url: p.avatar_url,
            current_status: p.current_status as TaskStatus | null,
            created_at: p.created_at,
          },
          role: roleMap.get(p.user_id) || null,
        }));

        // Sort: Leadership first, then alphabetically
        teamMembers.sort((a, b) => {
          const aIsLeadership = a.role && LEADERSHIP_ROLES.includes(a.role);
          const bIsLeadership = b.role && LEADERSHIP_ROLES.includes(b.role);
          if (aIsLeadership && !bIsLeadership) return -1;
          if (!aIsLeadership && bIsLeadership) return 1;
          return a.profile.full_name.localeCompare(b.profile.full_name);
        });

        setMembers(teamMembers);
      }
      setIsFetching(false);
    };

    if (user) fetchMembers();
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Team Directory
          </h2>
          <p className="text-muted-foreground mt-1">
            All team members and their current status
          </p>
        </div>

        {isFetching ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading team members...
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No team members found
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {members.map((member) => (
              <KryptonIdCard
                key={member.profile.user_id}
                profile={member.profile}
                role={member.role}
                onClick={() => {
                  // Normal users can only view their own My Space
                  if (member.profile.user_id === user.id) {
                    navigate('/my-space');
                  } else if (isCaptainOrVice) {
                    // TL/VC can view any member's profile
                    navigate(`/member/${member.profile.user_id}`);
                  }
                }}
                onViewProfile={isCaptainOrVice ? () => navigate(`/member/${member.profile.user_id}`) : undefined}
                showProfileIcon={isCaptainOrVice}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Team;
