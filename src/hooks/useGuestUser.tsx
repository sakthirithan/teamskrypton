import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export type TestUserType = 'real' | 'primary_test' | 'secondary_test';
export type KryptonRole = 'team_captain' | 'vice_captain' | 'strategist' | 'team_manager' | 'team_member';

interface GuestUserState {
  isGuest: boolean;
  isPrimaryTest: boolean;
  isSecondaryTest: boolean;
  userType: TestUserType;
  simulatedRole: KryptonRole | null;
  expiresAt: string | null;
  isExpired: boolean;
}

export function useGuestUser() {
  const { user, role, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [guestState, setGuestState] = useState<GuestUserState>({
    isGuest: false,
    isPrimaryTest: false,
    isSecondaryTest: false,
    userType: 'real',
    simulatedRole: null,
    expiresAt: null,
    isExpired: false,
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // Fetch guest user status
  useEffect(() => {
    if (!user) {
      setGuestState({
        isGuest: false,
        isPrimaryTest: false,
        isSecondaryTest: false,
        userType: 'real',
        simulatedRole: null,
        expiresAt: null,
        isExpired: false,
      });
      setIsLoading(false);
      return;
    }

    const fetchGuestStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_type, simulated_role, expires_at')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        const userType = (data?.user_type || 'real') as TestUserType;
        const simulatedRole = data?.simulated_role as KryptonRole | null;
        const expiresAt = data?.expires_at;
        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
        
        setGuestState({
          isGuest: userType !== 'real',
          isPrimaryTest: userType === 'primary_test',
          isSecondaryTest: userType === 'secondary_test',
          userType,
          simulatedRole,
          expiresAt,
          isExpired,
        });

        // If expired, force logout
        if (isExpired) {
          toast({
            title: 'Test Session Expired',
            description: 'This test account is no longer active.',
            variant: 'destructive',
          });
          await signOut();
          navigate('/auth');
        }
      } catch (error) {
        console.error('Error fetching guest status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuestStatus();
  }, [user, signOut, navigate, toast]);

  // Check expiry periodically
  useEffect(() => {
    if (!guestState.isGuest || !guestState.expiresAt) return;

    const checkExpiry = () => {
      const isNowExpired = new Date(guestState.expiresAt!) < new Date();
      if (isNowExpired && !guestState.isExpired) {
        toast({
          title: 'Test Session Expired',
          description: 'This test account is no longer active.',
          variant: 'destructive',
        });
        signOut();
        navigate('/auth');
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [guestState.isGuest, guestState.expiresAt, guestState.isExpired, signOut, navigate, toast]);

  // Switch simulated role (Primary Test Users only)
  const switchSimulatedRole = useCallback(async (newRole: KryptonRole) => {
    if (!user || !guestState.isPrimaryTest) {
      toast({
        title: 'Not Allowed',
        description: 'Only Primary Test Users can switch roles.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ simulated_role: newRole })
        .eq('user_id', user.id);

      if (error) throw error;

      // Log the role switch
      await supabase.from('guest_audit_log').insert({
        guest_user_id: user.id,
        action: 'role_switch',
        details: { from: guestState.simulatedRole, to: newRole },
      });

      setGuestState(prev => ({ ...prev, simulatedRole: newRole }));
      
      toast({
        title: 'Role Switched',
        description: `Now simulating ${newRole.replace('_', ' ')} role.`,
      });
      
      return true;
    } catch (error) {
      console.error('Error switching role:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch role.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, guestState.isPrimaryTest, guestState.simulatedRole, toast]);

  // Get effective role for UI display (simulated for primary, actual for others)
  const getEffectiveRole = useCallback((): KryptonRole | null => {
    if (guestState.isPrimaryTest && guestState.simulatedRole) {
      return guestState.simulatedRole;
    }
    return role as KryptonRole | null;
  }, [guestState.isPrimaryTest, guestState.simulatedRole, role]);

  // Check if action is allowed for guest user
  const isActionAllowed = useCallback((action: 'delete' | 'close_session' | 'export' | 'modify_real_data'): boolean => {
    if (!guestState.isGuest) return true;
    
    // Secondary test users can't do destructive actions
    if (guestState.isSecondaryTest) {
      return false;
    }
    
    // Primary test users can do some actions on their own data
    if (guestState.isPrimaryTest) {
      // These are still restricted
      if (action === 'modify_real_data') return false;
      return true;
    }
    
    return false;
  }, [guestState.isGuest, guestState.isPrimaryTest, guestState.isSecondaryTest]);

  // Get restriction message
  const getRestrictionMessage = useCallback((action: string): string => {
    if (!guestState.isGuest) return '';
    
    if (guestState.isSecondaryTest) {
      return 'Restricted in Guest Mode. This action is not available for test users.';
    }
    
    if (action === 'modify_real_data') {
      return 'Cannot modify real user data in test mode.';
    }
    
    return '';
  }, [guestState.isGuest, guestState.isSecondaryTest]);

  return {
    ...guestState,
    isLoading,
    switchSimulatedRole,
    getEffectiveRole,
    isActionAllowed,
    getRestrictionMessage,
  };
}
