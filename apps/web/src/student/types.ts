export const STUDENT_CATEGORIES = [
  'Stress & Anxiety',
  'Emotional Wellbeing',
  'Healthy Relationships',
  'Grief & Resilience',
  'Digital Wellness',
] as const;

export type StudentCategory = (typeof STUDENT_CATEGORIES)[number];

export type GuideSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export type Guide = {
  id: string;
  slug: string;
  title: string;
  category: StudentCategory;
  readMinutes: number;
  summary: string;
  accent: string;
  motif: string;
  sections: GuideSection[];
  keyTakeaways: string[];
  grounding: Array<{ title: string; detail: string }>;
  reflections: string[];
};

export type SupportContact = {
  id: string;
  label: string;
  channel: 'phone' | 'whatsapp' | 'sms' | 'email' | 'url';
  value: string;
  detail?: string;
};

export const REACH_OUT_METHODS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
] as const;

export type ContactMethod = (typeof REACH_OUT_METHODS)[number]['value'];

export const REACH_OUT_TOPICS = [
  { value: 'stress-anxiety', label: 'Stress & anxiety' },
  { value: 'low-mood', label: 'Low mood & burnout' },
  { value: 'relationships', label: 'Relationships & family' },
  { value: 'grief', label: 'Grief & loss' },
  { value: 'digital-wellbeing', label: 'Digital wellbeing' },
  { value: 'supporting-a-friend', label: 'Supporting a friend' },
  { value: 'other', label: 'Something else' },
] as const;

export type SupportTopic = (typeof REACH_OUT_TOPICS)[number]['value'];

export const REACH_OUT_URGENCIES = [
  { value: 'within-24-hours', label: 'Within 24 hours' },
  { value: 'this-week', label: 'This week' },
  { value: 'general-check-in', label: 'General check-in' },
] as const;

export type Urgency = (typeof REACH_OUT_URGENCIES)[number]['value'];
