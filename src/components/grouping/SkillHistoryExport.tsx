import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { useSkillTracks } from '@/hooks/useSkillTracks';
import { useSkillDevLinks } from '@/hooks/useSkillDevLinks';
import { useMemberSkills } from '@/hooks/useMemberSkills';
import { useSkillEndorsements } from '@/hooks/useSkillEndorsements';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface SkillHistoryExportProps {
  sessionId: string;
  userId: string;
  userName: string;
}

export function SkillHistoryExport({ sessionId, userId, userName }: SkillHistoryExportProps) {
  const { tracks } = useSkillTracks(sessionId, userId);
  const { skills } = useMemberSkills(userId);
  const { endorsements } = useSkillEndorsements(userId);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchAllData = async () => {
    // Fetch all blocks + links for each track
    const allBlocks: any[] = [];
    const allLinks: any[] = [];
    const allReflections: any[] = [];

    for (const track of tracks) {
      const { data: blocks } = await supabase
        .from('skill_flowchart_blocks')
        .select('*')
        .eq('skill_track_id', track.id)
        .order('sort_order');
      if (blocks) allBlocks.push(...blocks.map(b => ({ ...b, skill_name: track.skill_name, week_start: track.week_start })));

      const { data: links } = await supabase
        .from('skill_dev_links' as any)
        .select('*')
        .eq('skill_track_id', track.id);
      if (links) allLinks.push(...(links as any[]).map(l => ({ ...l, skill_name: track.skill_name, week_start: track.week_start })));

      const { data: reflections } = await supabase
        .from('skill_reflections' as any)
        .select('*')
        .eq('skill_track_id', track.id);
      if (reflections) allReflections.push(...(reflections as any[]).map(r => ({ ...r, skill_name: track.skill_name })));
    }

    return { allBlocks, allLinks, allReflections };
  };

  const exportXLSX = async () => {
    setIsExporting(true);
    try {
      const { allBlocks, allLinks, allReflections } = await fetchAllData();
      const wb = XLSX.utils.book_new();

      // Sheet 1: Skill Tracks
      const tracksData = tracks.map(t => ({
        'Skill Name': t.skill_name,
        'Week Start': t.week_start,
        'Is Primary': t.is_primary ? 'Yes' : 'No',
        'Created At': format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tracksData), 'Skill Tracks');

      // Sheet 2: Learning Steps
      const stepsData = allBlocks.map((b, i) => ({
        'S.No': i + 1,
        'Skill': b.skill_name,
        'Step': b.title,
        'Description': b.description || '-',
        'Status': b.status,
        'Resource URL': b.resource_url || '-',
        'Week': b.week_start,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stepsData), 'Learning Steps');

      // Sheet 3: Dev Links
      const linksData = allLinks.map((l, i) => ({
        'S.No': i + 1,
        'Skill': l.skill_name,
        'Title': l.title,
        'URL': l.url,
        'Type': l.link_type,
        'Week': l.week_start,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linksData), 'Development Links');

      // Sheet 4: Reflections
      if (allReflections.length > 0) {
        const refData = allReflections.map((r, i) => ({
          'S.No': i + 1,
          'Skill': r.skill_name,
          'Week': r.week_start,
          'What I Learned': r.content,
          'Challenges': r.challenges || '-',
          'Next Steps': r.next_steps || '-',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(refData), 'Reflections');
      }

      // Sheet 5: Member Skills Portfolio
      if (skills.length > 0) {
        const skillsData = skills.map(s => ({
          'Skill': s.skill_name,
          'Type': s.skill_type,
          'Domain': s.domain,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(skillsData), 'Skill Portfolio');
      }

      // Sheet 6: Endorsements
      if (endorsements.length > 0) {
        const endData = endorsements.map((e, i) => ({
          'S.No': i + 1,
          'Skill ID': e.member_skill_id,
          'Endorsed At': format(new Date(e.created_at), 'yyyy-MM-dd HH:mm'),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(endData), 'Endorsements');
      }

      const filename = `Skill_History_${userName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast({ title: 'Exported!', description: `Saved as ${filename}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: e.message });
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportJSON = async () => {
    setIsExporting(true);
    try {
      const { allBlocks, allLinks, allReflections } = await fetchAllData();
      const exportData = {
        exported_at: new Date().toISOString(),
        user: userName,
        skill_tracks: tracks,
        learning_steps: allBlocks,
        development_links: allLinks,
        reflections: allReflections,
        skill_portfolio: skills,
        endorsements,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Skill_History_${userName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported!', description: 'JSON file downloaded.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: e.message });
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="w-4 h-4 mr-1" /> Export History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Skill History</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Download all your skill development data including tracks, steps, links, reflections, and endorsements.
          </p>
          <Button onClick={exportXLSX} className="w-full" disabled={isExporting} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Download as XLSX (Excel)'}
          </Button>
          <Button onClick={exportJSON} className="w-full" disabled={isExporting} variant="outline">
            <FileJson className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Download as JSON'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
