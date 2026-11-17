import type { Guide, SupportContact } from './types';

/**
 * Mirror of the curated library served by `GET /api/v1/student/content`.
 * Shipped in the bundle so the hub renders instantly while the API wakes up
 * (Render cold starts) or when the API is unreachable.
 */
export const fallbackGuides: Guide[] = [
  {
    id: 'guide-anxiety-overthinking',
    slug: 'understanding-anxiety-overthinking-exam-pressure',
    title: 'Understanding Anxiety, Overthinking & Exam Pressure',
    category: 'Stress & Anxiety',
    readMinutes: 6,
    summary:
      'Why your body sounds the alarm before a CAT or a presentation, why overthinking feels productive when it is not, and small habits that lower the volume.',
    accent: '#c2652a',
    motif: '◌',
    sections: [
      {
        heading: 'What anxiety is actually doing',
        paragraphs: [
          'Anxiety is your body trying to protect you. Before a presentation or a CAT, your brain decides something important is at stake and floods you with adrenaline so you can respond fast. That is why your heart races, your palms sweat, your stomach knots and your thoughts jump ahead to every way the day could go wrong.',
          'The feeling is not a sign that something is wrong with you. It becomes a problem when the alarm keeps ringing long after the exam room is empty, when it stops you from sleeping, eating, showing up or asking for help.',
          'Physical signs you may notice: a tight chest, headaches, a dry mouth, restlessness, a churning stomach, or shoulders that will not drop. Naming the feeling — "this is my body preparing, not a warning" — already lowers the alarm a little.',
        ],
        bullets: [
          'Anxiety is a normal body response, not a character flaw.',
          'It becomes heavy when it lasts days, not moments.',
          'Slow breathing, water and movement tell your body the threat has passed.',
        ],
      },
      {
        heading: 'Overthinking is a loop, not a plan',
        paragraphs: [
          'Overthinking feels like work. You replay a conversation, rewrite a message twelve times, imagine the worst outcome and rehearse a defence. But a loop never produces the next step — it only adds pressure.',
          'Try the twenty-minute rule: give the worry a real appointment. Set a timer, write every "what if" on paper, and when it rings, stand up and do one small task that needs your hands. Most worries lose their weight once they are written down and time-boxed.',
          'Ask one deciding question: "What is the next single action I control?" Then do only that. Next actions look small — send the email, wash your face, open the notes, tell a friend. Small actions break loops.',
        ],
      },
      {
        heading: 'Exam pressure without losing yourself',
        paragraphs: [
          'Exam pressure gets loud when your worth and your results become the same thing. They are not. A grade measures how well you answered one paper on one day; it does not measure your kindness, your effort or your future.',
          'Study in blocks you can keep. Fifty minutes of focus, ten minutes off the screen. Sleep is not a luxury you earn after revision — it is what actually fixes information in your memory, and the night-before cram usually costs more than it gives.',
          'Tell one person about the pressure you are under. A classmate, a sibling, a facilitator. Pressure that stays inside the silence usually grows; pressure that is spoken shrinks to a size you can carry.',
        ],
        bullets: [
          'Chunk revision into blocks with real breaks.',
          'Protect sleep — it is part of the study plan.',
          'Compare your progress to your own last week, not to someone else’s feed.',
        ],
      },
    ],
    keyTakeaways: [
      'Anxiety is your body preparing, not a verdict about you.',
      'Overthinking is a loop; a single next action breaks it.',
      'Sleep, movement and one trusted person are real study tools.',
      'You are not your results — one paper does not define you.',
    ],
    grounding: [
      {
        title: 'Plant your feet',
        detail: 'Press both feet flat on the floor. Notice the ground holding you, and let your shoulders drop away from your ears.',
      },
      {
        title: 'Breathe out longer',
        detail: 'Breathe in for four counts, out for six. The longer out-breath tells your body the alarm can switch off. Repeat five times.',
      },
      {
        title: 'Name five things',
        detail: 'Say five things you can see and three things you can hear. This pulls your mind out of the future and back into the room.',
      },
    ],
    reflections: [
      'When does the alarm in my body usually start ringing, and what does it feel like first?',
      'Which worry can I put into a twenty-minute appointment this week?',
      'Who is one person I can say the pressure out loud to?',
    ],
  },
  {
    id: 'guide-low-moods-burnout',
    slug: 'navigating-low-moods-burnout-and-depression',
    title: 'Navigating Low Moods, Burnout & Depression',
    category: 'Emotional Wellbeing',
    readMinutes: 7,
    summary:
      'The difference between a hard week and something deeper, the signs of burnout that look like laziness, and gentle steps that actually help.',
    accent: '#8c3c3c',
    motif: '❍',
    sections: [
      {
        heading: 'A hard week or something deeper',
        paragraphs: [
          'Everyone has heavy days. A hard week usually has a cause you can name — an argument, a rejection, a sleepless stretch — and it lifts when the cause eases. Depression feels different: the heaviness stays for weeks, it follows you into things you used to enjoy, and it starts changing how you see yourself.',
          'Signs worth paying attention to: sleeping too much or too little, eating far less or far more, finding it hard to concentrate, withdrawing from friends, feeling numb or empty, thinking "everyone would be better off without me".',
          'If several of these are true for most days over two weeks or more, that is a reason to reach out to a professional — not a reason to try harder alone. Depression is treatable, and asking early makes the path shorter.',
        ],
        bullets: [
          'Low mood lifts with its cause; depression stays and spreads.',
          'Two or more weeks of most days is the usual signal to get support.',
          'Thinking of harming yourself is an emergency — reach out immediately.',
        ],
      },
      {
        heading: 'Burnout is not laziness',
        paragraphs: [
          'Burnout comes from prolonged strain — long hours, unpaid effort, caring for others while nobody checks on you — and it shows up as exhaustion you cannot sleep off. You look at work you used to handle easily and feel detached, irritable, or completely flat.',
          'When you are burnt out, rest does not feel rewarding and trying harder makes it worse. That is not a character problem; it is your tank running dry. The fix is a load problem, not a willpower problem.',
          'Look at the load honestly. What can be dropped, delayed, or given to someone else this week? Even one removed commitment creates space for recovery to start.',
        ],
      },
      {
        heading: 'Small steps that actually help',
        paragraphs: [
          'The instinct of a low mood is to wait until you feel like doing something. A more reliable path is the reverse: do something small first, and let the feeling follow.',
          'Start with a step so small it feels almost silly — open the window, take a shower, walk to the shop, message one friend. Do not wait for motivation; borrow it from momentum.',
          'Add what your body needs: water, food, daylight, sleep at roughly the same hour, and movement that is enjoyable rather than punishing. And talk to someone trained to help — a counsellor, a wellness partner, or the support lines on the Reach-Out page.',
        ],
        bullets: [
          'Motion before motivation — take one tiny step first.',
          'Tell one person the truth about how heavy this feels.',
          'Professional support is a tool, not a last resort.',
        ],
      },
    ],
    keyTakeaways: [
      'Low mood with a cause eases; persistent heaviness is worth professional support.',
      'Burnout is a load problem, so the answer is a load change, not more effort.',
      'Action comes before motivation, not after it.',
      'Asking for help early is a skill, not a weakness.',
    ],
    grounding: [
      {
        title: 'One kind thing',
        detail: 'Do one small kind thing for your body right now — a glass of water, a warm shower, opening a window.',
      },
      {
        title: 'The two-minute rule',
        detail: 'Choose one task you can finish in two minutes and finish it. Momentum is built from evidence, not pep talks.',
      },
      {
        title: 'One voice',
        detail: 'Send one honest message to one person you trust. You do not need the whole story — "I am having a hard week" is enough.',
      },
    ],
    reflections: [
      'What have I been calling laziness that is actually exhaustion?',
      'Which commitment could I pause this week without losing anything permanent?',
      'What is one tiny step I could take in the next ten minutes?',
    ],
  },
  {
    id: 'guide-boundaries',
    slug: 'setting-healthy-boundaries-with-peers-and-family',
    title: 'Setting Healthy Boundaries with Peers & Family',
    category: 'Healthy Relationships',
    readMinutes: 6,
    summary:
      'Boundaries are not walls — they are instructions. Scripts for saying no with care, and for holding limits inside family expectations.',
    accent: '#2f6f5e',
    motif: '⌁',
    sections: [
      {
        heading: 'Boundaries protect connection',
        paragraphs: [
          'A boundary is a clear, kind statement of what you can and cannot offer. It tells people how to stay close to you safely — what to ask, how to reach you, when you are available.',
          'Without boundaries, a relationship survives on guessing, resentment and the quiet hope that someone will notice. Resentment is often a boundary that was never spoken.',
          'Boundaries are about your own behaviour, not controlling someone else. "I cannot lend money again this month," not "you must stop asking me."',
        ],
        bullets: [
          'Boundaries say what you can offer, not what the other person must feel.',
          'Resentment usually points at an unspoken boundary.',
          'A boundary without follow-through becomes a suggestion.',
        ],
      },
      {
        heading: 'Saying no without a speech',
        paragraphs: [
          'Most of us over-explain because we expect to be talked out of it. You do not owe anyone a long justification. Short and warm works better than long and shaky.',
          'Try these: "I have to say no this week — my schedule is full." "I care about you, and I am not the right person for this one." "I can help for an hour on Saturday, not before." "I need to think about that and come back to you tomorrow."',
          'Expect discomfort, and let it pass. A gentle no that holds is more respectful than a yes that quietly builds resentment.',
        ],
      },
      {
        heading: 'When family expectations are loud',
        paragraphs: [
          'In many families, saying no can feel like betraying your people, especially when relatives have invested in your future. You can honour that investment and still need limits — those two things are allowed to coexist.',
          'Separate the value from the request. "I value education in this family. To keep it, I need two hours a day I do not give away." Framing the boundary as protection of a shared value lowers the sense of rejection.',
          'Choose one limit to hold rather than eight at once. Consistency on a single boundary teaches the relationship more than a dramatic conversation about all of them.',
        ],
        bullets: [
          'Honour the value, limit the request.',
          'One held boundary beats eight announcements.',
          'Speak calmly, repeat your line, do not argue the case again.',
        ],
      },
    ],
    keyTakeaways: [
      'Boundaries are instructions for staying close, not rejections.',
      'A short, warm no is more respectful than a resentful yes.',
      'One boundary you keep teaches more than a speech.',
      'You can respect your family and still hold a limit.',
    ],
    grounding: [
      {
        title: 'Find the knot',
        detail: 'Notice where you are holding tension — jaw, shoulders, hands. Unclench it slowly and take one fuller breath.',
      },
      {
        title: 'Write your line',
        detail: 'Write the one sentence you need to say, out loud in your head. Short sentences are easier to keep.',
      },
      {
        title: 'Pick your person',
        detail: 'Decide who you will tell afterwards. A boundary held with support is a boundary held longer.',
      },
    ],
    reflections: [
      'Where am I saying yes while my body says no?',
      'Which single boundary would give me the most relief this week?',
      'How can I phrase a limit as protection of something my family already values?',
    ],
  },
  {
    id: 'guide-grief-and-change',
    slug: 'coping-with-grief-change-and-hard-transitions',
    title: 'Coping with Grief, Change & Hard Transitions',
    category: 'Grief & Resilience',
    readMinutes: 7,
    summary:
      'Grief is not a straight line and change you did not choose still deserves care. How to carry loss, move through transition and build resilience.',
    accent: '#6a5a8c',
    motif: '✧',
    sections: [
      {
        heading: 'Grief has no timetable',
        paragraphs: [
          'Grief is the price of having loved or needed something. It arrives in waves — some days you are fine, then a song, a photograph or a phone contact unstitches the whole day.',
          'There are no stages you must complete in order, and no deadline for being over it. People who tell you to move on usually mean they are uncomfortable with your pain, which is their problem to hold, not yours to fix.',
          'Grief also lives in ordinary losses: a friendship that ended, a home you left, an exam year that did not go to plan, someone who is still alive but no longer in your life. Those losses count too.',
        ],
        bullets: [
          'Waves are normal — improving does not mean forgetting.',
          'Loss does not need to be a death to deserve grief.',
          'You get to say how much something mattered.',
        ],
      },
      {
        heading: 'Change you did not choose',
        paragraphs: [
          'Transitions — moving towns, repeating a term, a family splitting, a scholarship ending — take away the ground rules you learned to trust. Feeling disoriented is not a failure to cope; it is what transition feels like from the inside.',
          'Restore the smallest routines first: a morning drink, a weekly call home, the walk you always take. Familiar rhythms give your nervous system something predictable to hold.',
          'Let people matter again slowly. New places need new anchors, and building them takes months, not days. Give yourself the time you would give a friend.',
        ],
      },
      {
        heading: 'Resilience is built in small returns',
        paragraphs: [
          'Resilience is not hardness. It is your capacity to return — to sleep, to laugh, to study, to reach for someone — after something knocked you sideways. Each return strengthens the capacity to return next time.',
          'Write down what carried you through a hard week before: a cousin who called, a church group, running, a specific song. Those are your recovery tools, and they work faster when you name them in advance.',
          'If grief is making it impossible to eat, sleep, study or feel anything at all for weeks, get support. Carrying heavy loss alone is not a requirement of being strong.',
        ],
        bullets: [
          'Name the things that helped you recover before.',
          'Small routines rebuild a sense of ground.',
          'Reaching for support is part of resilience, not proof you lack it.',
        ],
      },
    ],
    keyTakeaways: [
      'Grief moves in waves and has no deadline.',
      'Losses other than death still deserve care.',
      'Small routines and named supports rebuild ground.',
      'Support during grief is strength, not failure.',
    ],
    grounding: [
      {
        title: 'Let the wave land',
        detail: 'Stop trying to fix the feeling for sixty seconds. Breathe out slowly and let the wave move through instead of pushing it away.',
      },
      {
        title: 'Name one anchor',
        detail: 'Say one thing from your day that did not change — a meal, a routine, a person who is still here.',
      },
      {
        title: 'One memory, kindly',
        detail: 'Think of one good moment connected to what you lost. Let warmth sit next to the ache instead of replacing it.',
      },
    ],
    reflections: [
      'What have I lost that I have not given myself permission to grieve?',
      'Which small routine still feels like mine?',
      'Who carried me through last time, and could I call them this week?',
    ],
  },
  {
    id: 'guide-digital-wellbeing',
    slug: 'digital-wellbeing-social-media-and-self-worth',
    title: 'Digital Wellbeing, Social Media & Self-Worth',
    category: 'Digital Wellness',
    readMinutes: 6,
    summary:
      'Why the highlight reel makes you feel behind, how feeds are designed to keep you scrolling, and practical ways to reclaim your attention.',
    accent: '#3f6b8c',
    motif: '◍',
    sections: [
      {
        heading: 'The highlight reel problem',
        paragraphs: [
          'Social media shows outcomes, not processes. You see the graduation photo, not the four years. You see the new phone, not the debt. When you compare your ordinary Tuesday with someone’s best three minutes, you will always come up short — that comparison is rigged.',
          'Keep a close circle of people whose real lives you actually know. If a feed regularly makes you feel small, that is information about the feed, not about your worth.',
          'Notice what you do after scrolling: energised, informed, calm — or hollow, restless, behind? That post-scroll feeling is your most honest review.',
        ],
        bullets: [
          'You are comparing your unedited day to edited highlights.',
          'The feeling after scrolling is real feedback, not weakness.',
          'Curate your feed like you curate your friends.',
        ],
      },
      {
        heading: 'Your attention is the product',
        paragraphs: [
          'Feeds are built to keep you scrolling: infinite load, autoplay, streaks and notifications. None of it is an accident, and none of it is a measure of your discipline.',
          'Turn the design down. Mute notifications for the app, move it off the home screen, set one time in the day for it, and let the streaks break. Every one of those removes a tug you did not choose to feel.',
          'Use a phone hour before bed without the feed. Sleep, not scroll, is what the next morning actually needs.',
        ],
      },
      {
        heading: 'Reclaiming your feed and your focus',
        paragraphs: [
          'Decide what you want your phone to give you — study help, family, creativity, humour — and remove what it takes. Unfollow mute quietly; you do not owe anyone a follow.',
          'Make one offline thing easier to reach than the app: a book on the pillow, notes open on the desk, shoes by the door. Friction is design too, and you can design yours.',
          'When you notice the hollow feeling, do not judge it — replace it. Message a real friend, step outside, stretch, or open the guide you were reading. Attention returns one choice at a time.',
        ],
        bullets: [
          'Turn off the notifications you never asked for.',
          'Decide what your phone is for, and delete what it is not.',
          'Replace the hollow scroll with one offline action.',
        ],
      },
    ],
    keyTakeaways: [
      'Feeds are highlight reels; comparison is rigged by design.',
      'Your attention is engineered for, so build your own friction.',
      'Unfollow, mute and switch off notifications without guilt.',
      'Replace the hollow scroll with one small offline action.',
    ],
    grounding: [
      {
        title: 'Put it down',
        detail: 'Place your phone face down, out of reach, for one minute. Notice the urge to pick it up without following it.',
      },
      {
        title: 'Name one real thing',
        detail: 'Say one true thing about your life that no feed shows — something you made, survived or learned this week.',
      },
      {
        title: 'One replacement',
        detail: 'Choose one offline action to do right after this: step outside, message a friend, drink water, stretch.',
      },
    ],
    reflections: [
      'Which app reliably leaves me feeling worse, and what keeps me going back?',
      'What would I do with the time I spend scrolling?',
      'What is one thing about my life that no feed shows?',
    ],
  },
  {
    id: 'guide-supporting-a-friend',
    slug: 'supporting-a-friend-and-knowing-when-to-reach-out',
    title: 'Supporting a Friend & Knowing When to Reach Out',
    category: 'Healthy Relationships',
    readMinutes: 5,
    summary:
      'What actually helps when a friend is struggling, how to listen without fixing, and the clear signs that mean a trusted adult must be involved.',
    accent: '#5c6b3f',
    motif: '♡',
    sections: [
      {
        heading: 'Listening is the first help',
        paragraphs: [
          'Most people in a hard place are not waiting for advice. They are waiting to be believed. "That sounds really heavy, and I am glad you told me" does more than ten suggestions.',
          'You do not need the perfect words. You need presence: sit with them, keep it confidential unless safety requires otherwise, and ask before advising — "Do you want ideas, or do you just need me to hear this?"',
          'Avoid the fixers: "at least", "everything happens for a reason", "others have it worse". They quietly tell the person their pain is not allowed to take up space.',
        ],
        bullets: [
          'Believe first; advice comes later, and only if asked for.',
          'Ask what they need — listening, ideas, or company.',
          'Keep what they tell you private, within the limits of safety.',
        ],
      },
      {
        heading: 'When a friend needs more than you can hold',
        paragraphs: [
          'You are a friend, not a therapist, and that is the right size. If someone is struggling for weeks, cannot eat or sleep, or is dropping out of everything, help them reach real support: a counsellor, a wellness partner, a support line.',
          'Offer to do it with them — help them send the message, sit with them while they call. The gap between "you should get help" and "I will help you do it" is where most people get stuck.',
          'If they are in immediate danger, contact a trusted adult, a helpline or emergency services straight away. A friend who is alive and upset with you is always better than the alternative. You are not betraying them by keeping them safe.',
        ],
        bullets: [
          'Persistent struggles belong with trained support.',
          'Make the first step easier — do it together.',
          'Immediate danger overrides confidentiality: get an adult or emergency help now.',
        ],
      },
      {
        heading: 'Looking after yourself too',
        paragraphs: [
          'Supporting someone is heavy, and your own limits are part of the care plan. You cannot pour from an empty cup, and you are allowed to say "I care about you and I need to sleep now — can we talk tomorrow?"',
          'If a friend’s situation is following you into your sleep, your studies or your mood, that is your signal to bring in someone else. Sharing the weight is not abandoning them.',
          'If you are the one struggling right now, the same rules apply to you: tell someone, take the small step, use the Reach-Out page. Asking is the brave part.',
        ],
      },
    ],
    keyTakeaways: [
      'Be present and believe them before you offer solutions.',
      'You are a friend, not a therapist — involve trained support.',
      'Immediate danger means getting help now, even without permission.',
      'Your own limits matter and are allowed.',
    ],
    grounding: [
      {
        title: 'Check yourself',
        detail: 'Before you reply to a heavy message, take one slow breath. Notice what you are feeling so you can respond instead of react.',
      },
      {
        title: 'Choose one line',
        detail: 'Pick one sentence: "That sounds heavy, I am glad you told me." Or "Do you want ideas, or just me listening?" Say it plainly.',
      },
      {
        title: 'Name one supporter',
        detail: 'Think of one adult or trained supporter who could help if this becomes bigger — write their name or number down now.',
      },
    ],
    reflections: [
      'Who in my life would I talk to if things got heavy?',
      'When a friend struggles, do I listen first or rush to fix?',
      'Which adult or service could I bring in if a friend was in danger?',
    ],
  },
];

/** Mirrors the API's fallback helpline cards for cold starts and offline use. */
export const fallbackSupportContacts: SupportContact[] = [
  {
    id: 'kenya-red-cross',
    label: 'Kenya Red Cross counselling',
    channel: 'phone',
    value: '1199',
    detail: 'Toll-free emotional support line, available day and night.',
  },
  {
    id: 'befrienders-kenya',
    label: 'Befrienders Kenya',
    channel: 'whatsapp',
    value: '254722178177',
    detail: 'Confidential listening by call or WhatsApp when a day feels too heavy.',
  },
  {
    id: 'childline-kenya',
    label: 'Childline Kenya',
    channel: 'phone',
    value: '116',
    detail: 'Free support line for young people who need to talk to someone now.',
  },
  {
    id: 'emergency-services',
    label: 'Emergency services',
    channel: 'phone',
    value: '999',
    detail: 'Call immediately if you or someone else is in danger right now.',
  },
];
