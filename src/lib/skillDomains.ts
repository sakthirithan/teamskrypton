export const DOMAIN_OPTIONS = [
  'AI',
  'Software',
  'Robotics',
  'Electronics',
  'Electrical',
  'Automation',
  'Mechanical',
  'Manufacturing',
  'Biology',
  'Agriculture',
  'Gaming',
  'Immersive',
  'Design',
  'Security',
  'Research',
  'General',
] as const;

export type DomainOption = typeof DOMAIN_OPTIONS[number];

export const SKILL_TO_DOMAIN_MAP: Record<string, DomainOption> = {
  // AI
  'agentic ai & llm optimization': 'AI',
  'big data analytics and machine learning': 'AI',
  'computer vision and image processing': 'AI',
  'edge ai': 'AI',
  'natural language processing': 'AI',
  'generative ai (gen ai)': 'AI',
  'prompt engineering': 'AI',

  // Software
  'full-stack software development': 'Software',
  'devops and it infrastructure': 'Software',
  'cloud computing': 'Software',
  'blockchain technology': 'Software',
  'business process intelligence (bpi)': 'Software',

  // Robotics
  'autonomous mobile robotics (amr)': 'Robotics',
  'robot systems integration': 'Robotics',
  'unmanned aerial systems': 'Robotics',
  'servo-drives & motion control': 'Robotics',
  'control system': 'Robotics',

  // Electronics
  'embedded systems & firmware': 'Electronics',
  'pcb design and development': 'Electronics',
  'fpga prototyping': 'Electronics',
  'vlsi & circuit design': 'Electronics',
  'digital signal processing': 'Electronics',
  'data acquisition system': 'Electronics',
  'iot and sensor integration': 'Electronics',

  // Electrical
  'battery management systems (bms)': 'Electrical',
  'power electronics & grid integration': 'Electrical',
  'power systems': 'Electrical',

  // Automation
  'plc and industrial control': 'Automation',
  'pneumatics & electro-pneumatics': 'Automation',

  // Mechanical
  'mechanical engineering cad and fea': 'Mechanical',
  'mechanical modelling': 'Mechanical',
  'mechanism design': 'Mechanical',
  'computational fluid dynamics (cfd)': 'Mechanical',

  // Manufacturing
  'design for manufacturing and assembly': 'Manufacturing',
  'additive manufacturing (3d printing)': 'Manufacturing',
  'manufacturing and fabrication': 'Manufacturing',
  'quality tools (six sigma/tqm)': 'Manufacturing',
  'continuous improvement (lean/kaizen)': 'Manufacturing',

  // Biology
  'bio-process engineering': 'Biology',
  'bioinformatics and data analytics': 'Biology',
  'molecular biology and genetic engineering': 'Biology',
  'microbial and plant bioprospecting': 'Biology',

  // Agriculture
  'precision agriculture (agri-tech)': 'Agriculture',

  // Gaming
  '3d game modeling': 'Gaming',
  'game development': 'Gaming',

  // Immersive
  'augmented reality (ar) & virtual reality (vr) development': 'Immersive',

  // Design
  'user experience (ui/ux) design': 'Design',
  'creativity': 'Design',
  'product thinking': 'Design',

  // Security
  'cyber security and cryptography': 'Security',

  // Research
  'research methodology': 'Research',
  'intellectual property rights (ipr)': 'Research',
  'report writing': 'Research',
};

export const SKILL_DOMAIN_LABELS: Record<string, string> = {
  AI: 'AI',
  Software: 'Software',
  Robotics: 'Robotics',
  Electronics: 'Electronics',
  Electrical: 'Electrical',
  Automation: 'Automation',
  Mechanical: 'Mechanical',
  Manufacturing: 'Manufacturing',
  Biology: 'Biology',
  Agriculture: 'Agriculture',
  Gaming: 'Gaming',
  Immersive: 'Immersive',
  Design: 'Design',
  Security: 'Security',
  Research: 'Research',
  General: 'General',
  ai_data: 'AI',
  software_dev: 'Software',
  research: 'Research',
  ui_ux: 'Design',
  general: 'General',
};

/**
 * Derives the effective domain label for a skill based on custom_domain, predefined skill mappings, or stored domain.
 */
export function getEffectiveDomain(
  skillName: string,
  domain?: string | null,
  customDomain?: string | null
): string {
  if (customDomain && customDomain.trim()) {
    return customDomain.trim();
  }

  const normalizedSkillName = (skillName || '').trim().toLowerCase();
  if (SKILL_TO_DOMAIN_MAP[normalizedSkillName]) {
    return SKILL_TO_DOMAIN_MAP[normalizedSkillName];
  }

  if (domain) {
    const trimmedDomain = domain.trim();
    const legacyMap: Record<string, string> = {
      ai_data: 'AI',
      software_dev: 'Software',
      research: 'Research',
      ui_ux: 'Design',
      general: 'General',
    };
    if (legacyMap[trimmedDomain]) return legacyMap[trimmedDomain];

    const matchedOption = DOMAIN_OPTIONS.find(
      opt => opt.toLowerCase() === trimmedDomain.toLowerCase()
    );
    if (matchedOption) return matchedOption;

    return trimmedDomain;
  }

  return 'General';
}

export function mapUiDomainToDbDomain(uiDomain: string): {
  domain: 'ai_data' | 'software_dev' | 'research' | 'ui_ux' | 'general';
  custom_domain: string | null;
} {
  const clean = uiDomain.trim();
  
  const uiToDbMap: Record<string, 'ai_data' | 'software_dev' | 'research' | 'ui_ux' | 'general'> = {
    'AI': 'ai_data',
    'Software': 'software_dev',
    'Robotics': 'software_dev',
    'Electronics': 'software_dev',
    'Electrical': 'general',
    'Automation': 'general',
    'Mechanical': 'general',
    'Manufacturing': 'general',
    'Biology': 'general',
    'Agriculture': 'general',
    'Gaming': 'software_dev',
    'Immersive': 'software_dev',
    'Design': 'ui_ux',
    'Security': 'software_dev',
    'Research': 'research',
    'General': 'general',
  };

  const dbDomain = uiToDbMap[clean] || 'general';
  
  const coreUiDomains = ['AI', 'Software', 'Design', 'Research', 'General'];
  const custom_domain = coreUiDomains.includes(clean) ? null : clean;

  return { domain: dbDomain, custom_domain };
}
