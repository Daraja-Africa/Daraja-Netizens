import type { StudentCategory } from './types';

/**
 * Curated outbound library for the Mental Health Educative Hub.
 *
 * Sourced from the Daraja Netizens content review (Nov 2025). These are external
 * charity, UN and public-health pages, so they stay as plain outbound cards with
 * an original summary and a Kenyan helpline note rather than being embedded —
 * never in an iframe, which would expose students to third-party cookies and
 * foreign crisis numbers.
 *
 * `needsReview` cards are vetted only in part: the link stays inactive until a
 * Daraja editor has read the full destination page.
 */

export type ResourceTrack = 'awareness' | 'wellbeing';

export type ResourceCard = {
  id: string;
  title: string;
  source: string;
  domain: string;
  url: string;
  track: ResourceTrack;
  category: StudentCategory;
  readMinutes: number;
  summary: string;
  accent: string;
  needsReview?: string;
};

export const RESOURCE_TRACKS: Array<{ id: ResourceTrack; label: string; blurb: string }> = [
  {
    id: 'awareness',
    label: 'Mental health awareness',
    blurb: 'What mental health actually is, and why talking about it openly matters.',
  },
  {
    id: 'wellbeing',
    label: 'Everyday wellbeing',
    blurb: 'Exam pressure, low mood, grief, friendships and staying well online.',
  },
];

export const KENYA_HELPLINES: Array<{ label: string; value: string; detail: string }> = [
  { label: '116', value: '116', detail: 'Childline Kenya — free, any time' },
  { label: '1199', value: '1199', detail: 'Kenya Red Cross counselling' },
  { label: '0800 723 253', value: '0800723253', detail: 'Befrienders Kenya — toll free' },
];

export const HUB_RESOURCES: ResourceCard[] = [
  {
    id: 'resource-magnificent-mei',
    title: 'The Comic Story of Magnificent Mei and Friends',
    source: 'WHO & UNICEF',
    domain: 'who.int',
    url: 'https://www.who.int/publications/i/item/9789240107960',
    track: 'awareness',
    category: 'Emotional Wellbeing',
    readMinutes: 4,
    summary:
      'An illustrated comic that follows Mei and her friends through ordinary worries, and shows the social and emotional skills you can practise at school.',
    accent: '#c2652a',
  },
  {
    id: 'resource-boma-wellness-clubs',
    title: 'Boma Wellness Clubs',
    source: 'Mental 360',
    domain: 'mental360.or.ke',
    url: 'https://mental360.or.ke/boma-wellness-clubs/',
    track: 'awareness',
    category: 'Emotional Wellbeing',
    readMinutes: 3,
    summary:
      'How Kenyan secondary schools run student-led wellness clubs: what a club does, who leads it, and how it makes talking about mental health feel normal.',
    accent: '#2f6f5e',
  },
  {
    id: 'resource-bright-shitemi',
    title: 'Talking Mental Health with Bright Shitemi',
    source: 'Mental 360',
    domain: 'mental360.or.ke',
    url: 'https://mental360.or.ke/talking-mental-health-with-executive-director-of-mental-360-bright-shitemi/',
    track: 'awareness',
    category: 'Emotional Wellbeing',
    readMinutes: 5,
    summary:
      'A plain-language Kenyan conversation that separates everyday mental health from conditions that can be treated, and explains what art, talk therapy and youth safe spaces are for.',
    accent: '#6a5a8c',
  },
  {
    id: 'resource-unicef-coping-strategies',
    title: 'Everyday Coping Strategies for Teens',
    source: 'UNICEF Kenya',
    domain: 'unicef.org',
    url: 'https://www.unicef.org/kenya/stories/how-teenagers-can-protect-their-mental-health-during-coronavirus-covid-19',
    track: 'wellbeing',
    category: 'Stress & Anxiety',
    readMinutes: 4,
    summary:
      'Six practical things teenagers can do to protect their mental health when life feels disrupted — routine, movement, sleep, staying connected and asking for help.',
    accent: '#3f6b8c',
    needsReview: 'Only the opening section has been checked so far.',
  },
  {
    id: 'resource-my-hero-is-you',
    title: 'My Hero is You — story book in English & Swahili',
    source: 'UNICEF Kenya',
    domain: 'unicef.org',
    url: 'https://www.unicef.org/kenya/press-releases/childrens-story-book-released-help-children-and-young-people-cope-covid-19',
    track: 'wellbeing',
    category: 'Emotional Wellbeing',
    readMinutes: 3,
    summary:
      'A short story book, available in English and Swahili, that helps younger readers and their families talk about big feelings and cope together.',
    accent: '#b06a8c',
  },
  {
    id: 'resource-exam-stress',
    title: 'How to Deal with Exam Stress',
    source: 'YoungMinds',
    domain: 'youngminds.org.uk',
    url: 'https://www.youngminds.org.uk/young-person/coping-with-life/exam-stress/',
    track: 'wellbeing',
    category: 'Stress & Anxiety',
    readMinutes: 5,
    summary:
      'What exam pressure does to your body and mood, why comparing yourself to others makes it louder, and how to revise, rest and remember that grades are not your worth.',
    accent: '#c2652a',
  },
  {
    id: 'resource-exam-stress-peer-story',
    title: 'How to Manage Stress in the Lead-Up to Exams',
    source: 'YoungMinds',
    domain: 'youngminds.org.uk',
    url: 'https://www.youngminds.org.uk/young-person/blog/how-to-manage-stress-in-the-lead-up-to-exams/',
    track: 'wellbeing',
    category: 'Stress & Anxiety',
    readMinutes: 3,
    summary:
      'A peer-written account of revision blocks that actually hold: two or three a day, real breaks in between, and talking to an adult you trust.',
    accent: '#8c3c3c',
  },
  {
    id: 'resource-nhs-depression',
    title: 'Understanding Depression (0–18 guide)',
    source: 'NHS Black Country',
    domain: 'blackcountry0-18.nhs.uk',
    url: 'https://www.blackcountry0-18.nhs.uk/mental-health-and-wellbeing/conditions/depression',
    track: 'wellbeing',
    category: 'Emotional Wellbeing',
    readMinutes: 5,
    summary:
      'Explains persistent low mood, why it cannot be snapped out of, and how routine, sleep, movement, company and telling a trusted adult all help recovery.',
    accent: '#8c3c3c',
  },
  {
    id: 'resource-youngminds-depression',
    title: 'Depression Guide for Young People',
    source: 'YoungMinds',
    domain: 'youngminds.org.uk',
    url: 'https://www.youngminds.org.uk/young-person/mental-health-conditions/depression/',
    track: 'wellbeing',
    category: 'Emotional Wellbeing',
    readMinutes: 5,
    summary:
      'Written with young people who have lived through depression: what it can feel like, what helps, and how to ask for support without shame.',
    accent: '#6a5a8c',
    needsReview: 'Only the page accreditation has been checked so far.',
  },
  {
    id: 'resource-youngminds-social-media',
    title: 'Social Media and Mental Health',
    source: 'YoungMinds',
    domain: 'youngminds.org.uk',
    url: 'https://www.youngminds.org.uk/young-person/coping-with-life/social-media-and-mental-health/',
    track: 'wellbeing',
    category: 'Digital Wellness',
    readMinutes: 4,
    summary:
      'The good side of being online, plus limits that help: muting notifications, unfollowing upsetting accounts, keeping phones out of the bedroom, asking before posting photos.',
    accent: '#3f6b8c',
  },
  {
    id: 'resource-youngminds-my-feed',
    title: 'Taking Control of My Social Media Feed',
    source: 'YoungMinds',
    domain: 'youngminds.org.uk',
    url: 'https://www.youngminds.org.uk/young-person/blog/how-i-learnt-to-take-control-of-my-social-media-feed/',
    track: 'wellbeing',
    category: 'Digital Wellness',
    readMinutes: 3,
    summary:
      'A short reflection on curating a feed that supports you instead of shrinking you, from someone who rebuilt theirs.',
    accent: '#2f6f5e',
  },
  {
    id: 'resource-unicef-social-media',
    title: 'Is Social Media Bad for Teens’ Mental Health?',
    source: 'UNICEF',
    domain: 'unicef.org',
    url: 'https://www.unicef.org/stories/social-media-bad-teens-mental-health',
    track: 'wellbeing',
    category: 'Digital Wellness',
    readMinutes: 6,
    summary:
      'How feeds are built to hold your attention, the difference between scrolling and actually connecting, and what the evidence does and does not say yet.',
    accent: '#3f6b8c',
  },
  {
    id: 'resource-smartklick-childline',
    title: 'I Need Help — Childline Kenya portal',
    source: 'SmartKlick Kenya',
    domain: 'smartklick.org',
    url: 'https://smartklick.org/ke/i-need-help/',
    track: 'wellbeing',
    category: 'Digital Wellness',
    readMinutes: 2,
    summary:
      'Kenya-specific help for online bullying, image-based extortion, scams and threats, with a direct route to Childline Kenya’s free 116 line and WhatsApp.',
    accent: '#c2652a',
  },
  {
    id: 'resource-unicef-cyberbullying',
    title: 'How to Stop Cyberbullying',
    source: 'UNICEF',
    domain: 'unicef.org',
    url: 'https://www.unicef.org/stories/how-to-stop-cyberbullying',
    track: 'wellbeing',
    category: 'Digital Wellness',
    readMinutes: 4,
    summary:
      'What online harassment does to a person, and the practical steps that help: keep the evidence, block and report, and tell an adult you trust.',
    accent: '#5c6b3f',
  },
  {
    id: 'resource-youngminds-self-care',
    title: 'Self-Care Hub for Young People',
    source: 'YoungMinds',
    domain: 'youngminds.org.uk',
    url: 'https://www.youngminds.org.uk/young-person/coping-with-life/self-care/',
    track: 'wellbeing',
    category: 'Emotional Wellbeing',
    readMinutes: 4,
    summary:
      'Self-esteem, advert and social media pressure, and the small self-care habits that hold up during exam season.',
    accent: '#b06a8c',
    needsReview: 'Only a short excerpt has been checked so far.',
  },
  {
    id: 'resource-kidshealth-coping-hub',
    title: 'TeensHealth: Problems & Coping Hub',
    source: 'Nemours KidsHealth',
    domain: 'kidshealth.org',
    url: 'https://kidshealth.org/en/teens/your-mind/problems',
    track: 'wellbeing',
    category: 'Healthy Relationships',
    readMinutes: 5,
    summary:
      'Short, teen-written pages on cliques, disagreeing respectfully, ending a relationship kindly, and handling test stress.',
    accent: '#5c6b3f',
    needsReview: 'Directory also lists a self-harm article — specific sub-pages need picking first.',
  },
  {
    id: 'resource-youngminds-grief',
    title: 'How I Started Talking About My Grief',
    source: 'YoungMinds',
    domain: 'youngminds.org.uk',
    url: 'https://www.youngminds.org.uk/young-person/blog/how-i-started-talking-about-my-grief/',
    track: 'wellbeing',
    category: 'Grief & Resilience',
    readMinutes: 4,
    summary:
      'A peer story about grief that does not move in a straight line, plus three ways to support a grieving friend — including telling a trusted adult when you are worried.',
    accent: '#6a5a8c',
  },
  {
    id: 'resource-chatsafe',
    title: '#chatsafe for Young People',
    source: 'Orygen',
    domain: 'orygen.org.au',
    url: 'https://www.orygen.org.au/chatsafe/For-young-people',
    track: 'wellbeing',
    category: 'Digital Wellness',
    readMinutes: 5,
    summary:
      'What to do when a friend posts something distressing online, seven steps of digital self-care, and how to stay safe while talking about hard things.',
    accent: '#2f6f5e',
  },
];
