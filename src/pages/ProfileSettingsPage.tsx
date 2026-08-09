import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { useMemberSkills, SKILL_TYPE_LIMITS, SKILL_TYPE_LABELS, SkillType } from '@/hooks/useMemberSkills';
import { useMemberCommunities } from '@/hooks/useMemberCommunities';
import { DOMAIN_OPTIONS, getEffectiveDomain } from '@/lib/skillDomains';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Settings,
  Shield,
  Compass,
  Bell,
  SunMoon,
  Users,
  Target,
  ChevronRight,
  ArrowLeft,
  Upload,
  Trash2,
  Lock,
  Loader2,
  Plus,
  X,
  Camera,
  LogOut,
  HelpCircle,
  Activity,
  UserCheck,
  CheckCircle
} from 'lucide-react';

type SettingsCategory = 'profile' | 'personal' | 'academic' | 'skills' | 'communities' | 'preferences' | 'security';

export default function ProfileSettingsPage() {
  const { user, profile, role, isLeadership, refreshProfile, signOut } = useAuth();
  const { isGroupingMode } = useAppMode();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // Navigation and active panel states
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');
  const [activeMobileSection, setActiveMobileSection] = useState<SettingsCategory | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSavingBasic, setIsSavingBasic] = useState(false);

  // Skill states
  const { skills, assignSkill, removeSkill } = useMemberSkills(user?.id);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillType, setNewSkillType] = useState<SkillType>('primary');
  const [newSkillDomain, setNewSkillDomain] = useState(DOMAIN_OPTIONS[0]);

  // Communities states
  const { communities = [], addCommunity, removeCommunity } = useMemberCommunities(user?.id);
  const [newCommunityName, setNewCommunityName] = useState('');

  // Academic form states (editable by leadership)
  const [registerNumber, setRegisterNumber] = useState('');
  const [academicDepartment, setAcademicDepartment] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);

  // Security states
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Photo Cropper states
  const [selectedImgSrc, setSelectedImgSrc] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unsaved changes checking
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingCategoryChange, setPendingCategoryChange] = useState<SettingsCategory | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Communities Counts query
  const { data: allCommunitiesCounts = [], refetch: refetchCommunitiesCounts } = useQuery({
    queryKey: ['all-member-communities-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_communities')
        .select('community_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const getCommunityMemberCount = (name: string) => {
    const target = name.trim().toLowerCase();
    const count = allCommunitiesCounts.filter((c) => c.community_name?.trim().toLowerCase() === target).length;
    return Math.max(1, count);
  };

  // Sync basic profile data when loaded
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhoneNumber((profile as any).phone_number || '');
      setRegisterNumber((profile as any).register_number || '');
      setAcademicDepartment(profile.department || '');
      setCollegeEmail(profile.email || '');
      // Load persisted college name from localStorage (no DB column)
      const savedCollegeName = localStorage.getItem(`krypton_college_name_${profile.user_id}`);
      setCollegeName(savedCollegeName || 'Teams Krypton College');
    }
  }, [profile]);

  // Track dirty changes on form inputs
  useEffect(() => {
    if (profile) {
      const isChanged =
        fullName.trim() !== (profile.full_name || '').trim() ||
        phoneNumber.trim() !== (profile.phone_number || '').trim();
      setHasChanges(isChanged);
    }
  }, [fullName, phoneNumber, profile]);

  // Handle section switching with unsaved changes verification
  const handleSelectCategory = (category: SettingsCategory) => {
    if (hasChanges) {
      setPendingCategoryChange(category);
      setShowDiscardDialog(true);
    } else {
      setActiveCategory(category);
      setActiveMobileSection(category);
    }
  };

  const handleDiscardChanges = () => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
    }
    setHasChanges(false);
    setShowDiscardDialog(false);
    if (pendingCategoryChange) {
      setActiveCategory(pendingCategoryChange);
      setActiveMobileSection(pendingCategoryChange);
      setPendingCategoryChange(null);
    }
  };

  // Profile completion progress calculation
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    if (profile.full_name) score += 20;
    if (profile.avatar_url) score += 20;
    if (profile.phone_number) score += 20;
    if (skills.length > 0) score += 20;
    if (communities.length > 0) score += 20;
    return score;
  }, [profile, skills, communities]);

  const missingItems = useMemo(() => {
    const missing: string[] = [];
    if (!profile) return missing;
    if (!profile.full_name) missing.push('Full Name');
    if (!profile.avatar_url) missing.push('Profile Picture');
    if (!profile.phone_number) missing.push('Phone Number');
    if (skills.length === 0) missing.push('Add at least one skill');
    if (communities.length === 0) missing.push('Join at least one community');
    return missing;
  }, [profile, skills, communities]);

  // Handle Photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast({ variant: 'destructive', title: 'Invalid File', description: 'Only JPEG, PNG, and WEBP formats are supported.' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File Too Large', description: 'Maximum image size is 5MB.' });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImgSrc(reader.result as string);
        setCropZoom(1);
        setCropX(0);
        setCropY(0);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Cropped Image
  const handleSaveCrop = () => {
    if (!selectedImgSrc || !imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 200, 200);

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const size = Math.min(naturalWidth, naturalHeight);

    // Apply scale factor mapping zoom offsets relative to image dimensions
    const scaleFactor = size / 200;
    const dx = (naturalWidth - size) / 2 + cropX * scaleFactor;
    const dy = (naturalHeight - size) / 2 + cropY * scaleFactor;

    ctx.drawImage(
      img,
      dx, dy, size / cropZoom, size / cropZoom, // source rect
      0, 0, 200, 200 // dest rect
    );

    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

    // Update avatar url in database
    toast({ title: 'Uploading photo...', description: 'Saving your profile picture.' });
    supabase
      .from('profiles')
      .update({ avatar_url: compressedBase64 })
      .eq('user_id', user?.id)
      .then(async ({ error }) => {
        if (error) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } else {
          await refreshProfile();
          toast({ title: 'Success', description: 'Profile picture updated successfully.' });
          setCropperOpen(false);
          setSelectedImgSrc(null);
        }
      });
  };

  // Remove Photo
  const handleRemovePhoto = async () => {
    if (!profile?.avatar_url) return;
    toast({ title: 'Removing photo...' });
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('user_id', user?.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      await refreshProfile();
      toast({ title: 'Photo Removed' });
    }
  };

  // Save basic credentials (Name & Phone)
  const handleSaveBasic = async () => {
    if (!user?.id) return;
    if (!fullName.trim()) {
      toast({ variant: 'destructive', title: 'Required field', description: 'Name cannot be empty.' });
      return;
    }

    setIsSavingBasic(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim() || null,
      })
      .eq('user_id', user.id);

    setIsSavingBasic(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
      setHasChanges(false);
      await refreshProfile();
      toast({ title: 'Changes Saved', description: 'Your personal information was updated successfully.' });
    }
  };

  // Save academic / college details (leadership only)
  const handleSaveAcademic = async () => {
    if (!user?.id || !isLeadership) return;
    setIsSavingAcademic(true);

    // Persist college name in localStorage (no DB column)
    if (collegeName.trim() && profile?.user_id) {
      localStorage.setItem(`krypton_college_name_${profile.user_id}`, collegeName.trim());
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        register_number: registerNumber.trim() || null,
        department: academicDepartment.trim() || null,
        email: collegeEmail.trim() || undefined,
      } as any)
      .eq('user_id', user.id);
    setIsSavingAcademic(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
      await refreshProfile();
      toast({ title: 'College Details Updated', description: 'Academic information saved successfully.' });
    }
  };

  // Change Account Email Secure Flow
  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setIsUpdatingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setIsUpdatingEmail(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Change Failed', description: error.message });
    } else {
      setNewEmail('');
      toast({
        title: 'Verification Link Sent',
        description: 'Please check both your current and new email addresses to verify this change.',
      });
    }
  };

  // Skill Add helper
  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    const typeLabel = SKILL_TYPE_LABELS[newSkillType];
    const limits = SKILL_TYPE_LIMITS[newSkillType];
    const currentCount = skills.filter((s) => s.skill_type === newSkillType).length;

    if (currentCount >= limits.max) {
      toast({
        variant: 'destructive',
        title: 'Limit reached',
        description: `You can only add up to ${limits.max} ${typeLabel} skills.`,
      });
      return;
    }

    assignSkill.mutate({
      user_id: user!.id,
      skill_name: newSkillName.trim(),
      skill_type: newSkillType,
      domain: newSkillDomain,
    });
    setNewSkillName('');
  };

  // Community Add helper
  const handleJoinCommunity = () => {
    if (!newCommunityName.trim()) return;
    addCommunity.mutate(newCommunityName.trim(), {
      onSuccess: () => {
        setNewCommunityName('');
        refetchCommunitiesCounts();
      },
    });
  };

  // Layout selection depending on App Mode
  const handleBackToSpace = () => {
    navigate(isGroupingMode ? '/grouping/me' : '/my-space');
  };

  const menuItems: { id: SettingsCategory; label: string; icon: any; desc: string }[] = [
    { id: 'profile', label: 'Profile & Photo', icon: User, desc: 'Manage avatar and public display' },
    { id: 'personal', label: 'Personal Info', icon: UserCheck, desc: 'Contact numbers and name details' },
    { id: 'academic', label: 'College Details', icon: Compass, desc: 'Official student registration and institution' },
    { id: 'skills', label: 'Skills & Indicators', icon: Target, desc: 'Add primary, secondary, or specializations' },
    { id: 'communities', label: 'Communities', icon: Users, desc: 'View and join student communities' },
    { id: 'preferences', label: 'Preferences', icon: SunMoon, desc: 'Theme colors and visual settings' },
    { id: 'security', label: 'Security & Access', icon: Shield, desc: 'Manage email and security credentials' },
  ];

  // Panel rendering
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold">Profile Details</h3>
              <p className="text-xs text-muted-foreground">Modify your public initials and profile image</p>
            </div>

            {/* Profile Picture Panel */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-muted/20 border border-border/60">
              <div className="relative group w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 shrink-0 bg-muted">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-extrabold">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                >
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold gap-1.5 rounded-xl h-8 px-4"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Photo
                  </Button>
                  {profile?.avatar_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRemovePhoto}
                      className="text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/20 h-8 rounded-xl px-4"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal max-w-xs text-center sm:text-left font-medium">
                  Supports JPG, JPEG, PNG, or WEBP. Max size 5MB. Photo will crop automatically.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            {/* Profile Completion Indicator */}
            <div className="p-4 rounded-2xl border border-border/80 bg-card/60 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-foreground">Profile Completion</span>
                <span className="text-primary">{profileCompletion}%</span>
              </div>
              <Progress value={profileCompletion} className="h-2 rounded-full" />
              {missingItems.length > 0 ? (
                <div className="pt-1.5 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Recommended steps to complete:</p>
                  <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                    {missingItems.map((item, idx) => (
                      <li key={idx} className="font-medium">{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  Your profile is fully complete! Nice job!
                </p>
              )}
            </div>

            {/* Basic Info Preview (Read only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 border border-border/60 rounded-xl bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Account Email</span>
                <p className="text-sm font-semibold truncate mt-0.5">{profile?.email || '-'}</p>
              </div>
              <div className="p-3 border border-border/60 rounded-xl bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned Role</span>
                <p className="text-sm font-semibold capitalize mt-0.5">{role ? role.replace('_', ' ') : '-'}</p>
              </div>
            </div>
          </div>
        );

      case 'personal':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold">Personal Information</h3>
              <p className="text-xs text-muted-foreground">Manage your contact number and display names</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Full Name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Phone Number</Label>
                <div className="relative">
                  <Input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number (e.g. +91 9876543210)"
                    className="h-9 text-xs rounded-xl"
                  />
                  {phoneNumber && (
                    <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0 h-4 border-emerald-500/20 text-emerald-500 bg-emerald-500/5 font-bold">
                      Updated
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-border pt-4">
              {hasChanges ? (
                <span className="text-[10px] font-bold text-amber-500">⚠️ You have unsaved changes in this tab</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Ready</span>
              )}
              <Button
                onClick={handleSaveBasic}
                disabled={!hasChanges || isSavingBasic}
                className="text-xs font-bold uppercase tracking-wider rounded-xl h-9 px-5 shrink-0"
              >
                {isSavingBasic && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Save Changes
              </Button>
            </div>
          </div>
        );

      case 'academic':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold">College Details</h3>
              <p className="text-xs text-muted-foreground">
                {isLeadership
                  ? 'You have authority to update student academic records.'
                  : 'Verification details managed by the institution'}
              </p>
            </div>

            {isLeadership ? (
              /* ── Lead/Captain: editable academic form ── */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* College Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">College Name</Label>
                    <Input
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. Sri Venkateswara College of Engineering"
                      className="h-9 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground/70 font-medium">Registered university / institution name</p>
                  </div>

                  {/* Register Number */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Register Number</Label>
                    <Input
                      value={registerNumber}
                      onChange={(e) => setRegisterNumber(e.target.value)}
                      placeholder="e.g. 22CS123"
                      className="h-9 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground/70 font-medium">Institutional verification key</p>
                  </div>

                  {/* Department */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Department</Label>
                    <Input
                      value={academicDepartment}
                      onChange={(e) => setAcademicDepartment(e.target.value)}
                      placeholder="e.g. Computer Science Engineering"
                      className="h-9 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground/70 font-medium">Assigned stream / department</p>
                  </div>

                  {/* College Email */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">College Email</Label>
                    <Input
                      type="email"
                      value={collegeEmail}
                      onChange={(e) => setCollegeEmail(e.target.value)}
                      placeholder="e.g. student@college.edu"
                      className="h-9 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground/70 font-medium">Official institutional email address</p>
                  </div>

                </div>

                <div className="p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 flex gap-2">
                  <Shield className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-sky-600 dark:text-sky-400 font-medium leading-normal">
                    As a team leader, you can update college details and academic records. Changes are saved directly to the database.
                  </p>
                </div>

                <div className="flex justify-end border-t border-border pt-4">
                  <Button
                    onClick={handleSaveAcademic}
                    disabled={isSavingAcademic}
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-9 px-5"
                  >
                    {isSavingAcademic && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                    Save College Details
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Member: read-only view ── */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* College Name */}
                  <div className="p-4 border border-border/80 rounded-2xl bg-card space-y-1 sm:col-span-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">College Name</span>
                    <p className="text-sm font-bold tracking-tight text-foreground">{collegeName || 'N/A'}</p>
                    <p className="text-[10px] text-muted-foreground/80 font-medium pt-1">Registered university / institution name</p>
                  </div>

                  {/* Register Number */}
                  <div className="p-4 border border-border/80 rounded-2xl bg-card space-y-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Register Number</span>
                    <p className="text-sm font-bold tracking-tight text-foreground">{(profile as any)?.register_number || 'N/A'}</p>
                    <p className="text-[10px] text-muted-foreground/80 font-medium pt-1">Institutional verification key</p>
                  </div>

                  {/* Department */}
                  <div className="p-4 border border-border/80 rounded-2xl bg-card space-y-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Department</span>
                    <p className="text-sm font-bold tracking-tight text-foreground">{profile?.department || 'N/A'}</p>
                    <p className="text-[10px] text-muted-foreground/80 font-medium pt-1">Assigned stream / department</p>
                  </div>

                  {/* College Email */}
                  <div className="p-4 border border-border/80 rounded-2xl bg-card space-y-1 sm:col-span-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">College Email</span>
                    <p className="text-sm font-bold tracking-tight text-foreground">{profile?.email || 'N/A'}</p>
                    <p className="text-[10px] text-muted-foreground/80 font-medium pt-1">Official institutional email address</p>
                  </div>

                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium leading-normal">
                    Academic and institutional fields are locked for editing by student accounts. If any information is incorrect, please contact your Vice Captain or Team Captain to apply an override.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold">Skills & Indicators</h3>
              <p className="text-xs text-muted-foreground">Manage your skill set indicators (limits apply)</p>
            </div>

            {/* Active Skills List */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Active Skill Roster</Label>
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed border-border rounded-xl bg-muted/5 font-medium">
                    No skills assigned yet. Add some below.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {skills.map((s) => {
                      const typeLabel = SKILL_TYPE_LABELS[s.skill_type];
                      const effDomain = getEffectiveDomain(s.skill_name, s.domain, s.custom_domain);
                      return (
                        <div key={s.id} className="flex items-center justify-between p-3 border border-border/60 rounded-xl bg-card hover:shadow-xs transition-shadow">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-xs font-bold text-foreground truncate">{s.skill_name}</span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/20 text-primary uppercase font-bold">
                                {typeLabel}
                              </Badge>
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 uppercase font-bold">
                                {effDomain}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSkill.mutate(s.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                            title="Remove Skill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Skill Panel */}
              <div className="p-4 border border-border/80 rounded-2xl bg-card space-y-4">
                <Label className="text-xs font-bold text-foreground">Add New Skill</Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground">Skill Name</Label>
                    <Input
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      placeholder="e.g. Docker, Figma, PyTorch"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground">Category</Label>
                    <select
                      value={newSkillType}
                      onChange={(e) => setNewSkillType(e.target.value as SkillType)}
                      className="h-9 w-full bg-background border border-border rounded-xl px-3 text-xs focus-visible:outline-none"
                    >
                      <option value="primary">Primary (Max 2)</option>
                      <option value="secondary">Secondary (Max 2)</option>
                      <option value="specialization">Specialization (Max 3)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-bold text-muted-foreground">Domain Area</Label>
                    <select
                      value={newSkillDomain}
                      onChange={(e) => setNewSkillDomain(e.target.value)}
                      className="h-9 w-full bg-background border border-border rounded-xl px-3 text-xs focus-visible:outline-none"
                    >
                      {DOMAIN_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleAddSkill}
                    disabled={!newSkillName.trim()}
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-9 px-5 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Assign Skill
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'communities':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold">Communities</h3>
              <p className="text-xs text-muted-foreground">Join or leave official institutional student communities</p>
            </div>

            <div className="space-y-4">
              {/* Joined Communities */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Joined Communities ({communities.length})</Label>
                {communities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed border-border rounded-xl bg-muted/5 font-medium">
                    You have not joined any community. Add your name below to assign yourself.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {communities.map((c) => {
                      const count = getCommunityMemberCount(c.community_name);
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 border border-border/60 rounded-xl bg-card hover:shadow-xs transition-shadow">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-xs font-bold text-foreground truncate">{c.community_name}</span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/20 text-primary font-bold">
                                {count} {count === 1 ? 'member' : 'members'}
                              </Badge>
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 uppercase font-bold text-emerald-500 border-emerald-500/10 bg-emerald-500/5">
                                Active
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCommunity.mutate(c.community_name, { onSuccess: refetchCommunitiesCounts })}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                            title="Leave Community"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Join new community */}
              <div className="p-4 border border-border/80 rounded-2xl bg-card space-y-4">
                <Label className="text-xs font-bold text-foreground">Join Community</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newCommunityName}
                    onChange={(e) => setNewCommunityName(e.target.value)}
                    placeholder="Enter community name (e.g. Cloud & DevOps)"
                    className="h-9 text-xs rounded-xl flex-1"
                  />
                  <Button
                    onClick={handleJoinCommunity}
                    disabled={!newCommunityName.trim()}
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-9 px-5 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Join
                  </Button>
                </div>
                {communities.length < 2 && (
                  <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1.5 mt-1">
                    ⚠️ Complete profile requirement: Join at least 2 communities. ({communities.length}/2 joined)
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold">Theme Preferences</h3>
              <p className="text-xs text-muted-foreground">Adjust application colors and visual styles</p>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-bold text-foreground">Color Mode Selection</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { mode: 'light', label: 'Light Mode', desc: 'Clean white surfaces' },
                  { mode: 'dark', label: 'Dark Mode', desc: 'Soft charcoal tones' },
                  { mode: 'system', label: 'System Default', desc: 'Matches device color' },
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => setTheme(item.mode)}
                    className={`flex flex-col items-center justify-center p-4 border rounded-2xl text-center transition-all select-none ${
                      theme === item.mode
                        ? 'border-primary bg-primary/[0.04] shadow-xs'
                        : 'border-border/60 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground">{item.label}</span>
                    <span className="text-[9px] text-muted-foreground font-medium mt-1 leading-tight">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold">Security & Credentials</h3>
              <p className="text-xs text-muted-foreground">Update account security credentials and check auth details</p>
            </div>

            {/* Change Email */}
            <div className="p-4 border border-border/80 rounded-2xl bg-card space-y-4">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Change Account Email
              </Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground">New Email Address</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="student.new@college.edu"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleChangeEmail}
                    disabled={!newEmail.trim() || isUpdatingEmail}
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-9 px-5"
                  >
                    {isUpdatingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                    Update Email
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  const settingsContent = (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBackToSpace} className="h-8 text-xs font-bold gap-1.5 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
          Back to Space
        </Button>
      </div>

      {/* Main Settings Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[500px]">
        {/* Left Side Category Switcher (Desktop) */}
        <div className="hidden md:block md:col-span-4 space-y-1 border-r border-border/60 pr-6 py-2">
          <div className="px-3 pb-3">
            <h2 className="text-md font-extrabold flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Settings Center
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage details and credentials</p>
          </div>

          <div className="space-y-1">
            {menuItems.map((item) => {
              const ActiveIcon = item.icon;
              const active = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectCategory(item.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 border border-transparent select-none ${
                    active
                      ? 'bg-primary/[0.04] border-primary/10 text-primary font-bold shadow-xs'
                      : 'hover:bg-muted/50 text-foreground/80'
                  }`}
                >
                  <ActiveIcon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">{item.label}</span>
                    <span className="text-[9px] text-muted-foreground/80 font-medium truncate mt-0.5">{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Viewport (Desktop) */}
        <div className="hidden md:block md:col-span-8 py-2">
          <Card className="rounded-2xl border border-border/80 shadow-xs h-full">
            <CardContent className="p-6">
              {renderCategoryContent()}
            </CardContent>
          </Card>
        </div>

        {/* Mobile-First WhatsApp/Instagram List Selector (Mobile) */}
        <div className="block md:hidden col-span-1">
          {activeMobileSection === null ? (
            <div className="space-y-4">
              {/* Header profile info summary */}
              <div className="flex items-center gap-4 p-4 border border-border/80 rounded-2xl bg-card shadow-xs">
                <div className="w-14 h-14 rounded-full border border-border bg-primary/10 flex items-center justify-center text-primary text-xl font-bold overflow-hidden shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{profile?.full_name?.charAt(0)?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">{profile?.full_name || 'User'}</h3>
                  <p className="text-[10px] text-muted-foreground/80 font-medium truncate mt-0.5">{profile?.email}</p>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 mt-1.5 uppercase font-bold">
                    {role ? role.replace('_', ' ') : 'Member'}
                  </Badge>
                </div>
              </div>

              {/* Mobile menu categories list */}
              <div className="border border-border/80 rounded-2xl bg-card overflow-hidden divide-y divide-border/60 shadow-xs">
                {menuItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectCategory(item.id)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 active:bg-muted/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ItemIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-foreground">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground/80 font-medium truncate mt-0.5">{item.desc}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/80 shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>

              {/* Logout Button (Mobile) */}
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate('/auth');
                }}
                className="w-full border-destructive/20 text-destructive hover:bg-destructive/10 h-10 rounded-2xl text-xs font-bold uppercase tracking-wider gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            /* Slide-in Sub-Page Content for Mobile */
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (hasChanges) {
                    setShowDiscardDialog(true);
                  } else {
                    setActiveMobileSection(null);
                  }
                }}
                className="h-8 text-xs font-bold gap-1.5 rounded-xl hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Settings
              </Button>

              <Card className="rounded-2xl border border-border/80 shadow-xs">
                <CardContent className="p-4">
                  {renderCategoryContent()}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Discard changes verification warning modal */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="w-[90vw] max-w-sm rounded-2xl p-4 bg-card border-border shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <X className="w-4 h-4 text-destructive" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground leading-normal">
              You have unsaved changes in this tab. If you leave now, these modifications will be discarded. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDiscardDialog(false);
                setPendingCategoryChange(null);
              }}
              className="text-xs font-bold rounded-xl h-8 px-4"
            >
              Stay
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscardChanges}
              className="text-xs font-bold rounded-xl h-8 px-4"
            >
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Crop Dialog modal */}
      <Dialog open={cropperOpen} onOpenChange={(open) => {
        if (!open) {
          setCropperOpen(false);
          setSelectedImgSrc(null);
        }
      }}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl p-4 bg-card border-border shadow-2xl flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Crop Profile Photo
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground leading-normal">
              Adjust sliders below to scale and position your photo within the square cropping area.
            </DialogDescription>
          </DialogHeader>

          {/* Crop Area */}
          <div className="flex justify-center items-center py-4 bg-muted/20 border border-border/60 rounded-2xl relative overflow-hidden h-[240px]">
            <div className="w-40 h-40 rounded-full border-2 border-primary/80 overflow-hidden relative shadow-inner shrink-0 bg-black/10">
              {selectedImgSrc && (
                <img
                  ref={imageRef}
                  src={selectedImgSrc}
                  alt="Source"
                  style={{
                    transform: `translate(${cropX}px, ${cropY}px) scale(${cropZoom})`,
                    transition: 'transform 0.05s ease-out',
                  }}
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              )}
            </div>
          </div>

          {/* Cropper Sliders */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                <span>Zoom Scale</span>
                <span className="tabular-nums">{(cropZoom * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                  <span>Offset X</span>
                  <span className="tabular-nums">{cropX}px</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={cropX}
                  onChange={(e) => setCropX(parseInt(e.target.value))}
                  className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                  <span>Offset Y</span>
                  <span className="tabular-nums">{cropY}px</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={cropY}
                  onChange={(e) => setCropY(parseInt(e.target.value))}
                  className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCropperOpen(false);
                setSelectedImgSrc(null);
              }}
              className="text-xs font-bold rounded-xl h-8 px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCrop}
              className="text-xs font-bold rounded-xl h-8 px-4"
            >
              Apply Crop
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {isGroupingMode ? (
        <GroupingLayout title="Profile Settings">
          {settingsContent}
        </GroupingLayout>
      ) : (
        <PBLLayout title="Profile Settings">
          <div className="container mx-auto px-3 sm:px-6 py-6 pb-16 md:pb-6">
            {settingsContent}
          </div>
        </PBLLayout>
      )}
    </div>
  );
}
