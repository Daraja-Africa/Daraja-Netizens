export type FlashcardDeckId = 'facilitation' | 'literacy' | 'listening' | 'safeguarding' | 'operations';

export type Flashcard = {
  id: string;
  deckId: FlashcardDeckId;
  question: string;
  scenario: string;
  keyPoints: string[];
  dos: string[];
  donts: string[];
};

export type FlashcardDeck = {
  id: FlashcardDeckId;
  name: string;
  short: string;
  accent: 'ochre' | 'sage';
};

export const FLASHCARD_DECKS: FlashcardDeck[] = [
  { id: 'facilitation', name: 'Facilitation Skills & Classroom Engagement', short: 'Facilitation skills', accent: 'ochre' },
  { id: 'literacy', name: 'Youth Mental Health Literacy & 6-Week Curriculum', short: 'Mental health literacy', accent: 'sage' },
  { id: 'listening', name: 'Active Listening, Empathy & Peer Boundaries', short: 'Listening & boundaries', accent: 'ochre' },
  { id: 'safeguarding', name: 'Safeguarding, Red Flags & Psychologist Referral Protocol', short: 'Safeguarding & referral', accent: 'sage' },
  { id: 'operations', name: 'Daraja Operations, Attendance & Session Standards', short: 'Operations & standards', accent: 'ochre' },
];

/*
 * Source material: Daraja Africa Curriculum, Weeks 2 (Docs 1 and 2), 3 and 4
 * (Need-Based Peer Circles, Sexuality for Peer Counselors, take-home notes).
 */
export const FLASHCARDS: Flashcard[] = [
  // ---------- Deck 1: Facilitation Skills & Classroom Engagement ----------
  {
    id: 'fac-1',
    deckId: 'facilitation',
    question: 'You are a young volunteer. Students ask you to explain anxiety disorders and depression in detail. What do you do?',
    scenario: 'Week 2 circle. Several students want a "proper lesson" on diagnoses, and you do not feel qualified to give one.',
    keyPoints: [
      'Daraja facilitators guide discussion. They do not teach diagnostic detail, and they need no expertise to do it.',
      'Ask instead: "What struggles do teenagers commonly face?" Students will name academic pressure, family conflict, friend drama, bullying, social media pressure, loneliness, identity questions, grief and financial stress.',
      'Then ask: "How might these affect someone\'s mental health?" This keeps the talk in lived experience, not amateur diagnosis.',
      'Introduce each condition only as "may involve..." signs (for example worry, concentration, tension, avoidance).',
    ],
    dos: ['Hand the questions back to the circle.', 'Say that peer counsellors notice, listen, support and refer.'],
    donts: ['Do not explain anxiety disorders, depression, trauma or eating disorders in detail.', 'Do not label anyone in the room.'],
  },
  {
    id: 'fac-2',
    deckId: 'facilitation',
    question: 'A student drops a question into the Anonymous Question Box that you cannot answer. What is your script?',
    scenario: 'You read out a sensitive question about mental health and your mind goes blank.',
    keyPoints: [
      'You have permission not to answer everything.',
      'Say: "That\'s an important question. I don\'t know enough to answer it accurately, and I don\'t want to guess. Let\'s note it down and get a more informed answer."',
      'This models intellectual humility and protects students from misinformation.',
      'If a question is sensitive, model an appropriate response and the referral pathway.',
    ],
    dos: ['Note the question and bring back a better answer.', 'Use safe phrases such as "I don\'t know" and "Let\'s explore that together".'],
    donts: ['Do not guess to save face.', 'Do not say "I know exactly what\'s wrong" or "I had that and this is what fixed it".'],
  },
  {
    id: 'fac-3',
    deckId: 'facilitation',
    question: 'A student says, "Mental health is for rich people" or "Prayer should solve everything." How do you respond?',
    scenario: 'Students repeat messages from home and their faith community. Some agree loudly, and you worry about offending anyone.',
    keyPoints: [
      'Never frame it as "your parents are wrong" or "your church, mosque or temple is wrong".',
      'Use the frame: "People learn about mental health from many places: family, culture, religion, school, social media and experience. Some messages help us. Some may not tell the whole story."',
      'Ask: "What might be helpful about this belief? What might be unhelpful if taken too far?" For "be strong", students see it builds perseverance but can make people afraid to ask for help.',
      'Faith can be a source of strength, and people may also benefit from other help.',
    ],
    dos: ['Say: "Some people have heard this message growing up. What do you think about it?"', 'Invite faith leaders into the support map.'],
    donts: ['Do not set religion against psychology.', 'Do not say prayer alone is enough when safety is at risk.'],
  },
  {
    id: 'fac-4',
    deckId: 'facilitation',
    question: 'You use the "Myth or Fact?" game and students just guess the "right" answer. How do you get richer discussion?',
    scenario: 'The group answers quickly, but nobody is thinking about why.',
    keyPoints: [
      'Switch to "Always, Sometimes, or Never?".',
      'Use statements such as "Strong people never ask for help", "Stress is always bad", "Friends should always keep secrets", "Social media sometimes affects mental health", "Being alone is always unhealthy" and "Crying is always a sign of weakness".',
      'Students must think critically, so you get nuance instead of rigid labels.',
      'It fits the Week 2 goal: mental health literacy without pathologising.',
    ],
    dos: ['Ask "Where do these myths come from?" and "How can peer counsellors challenge misinformation?"', 'Ask "Which myths surprised you?"'],
    donts: ['Do not simply read out the answer key.', 'Do not mock a myth or the student who believes it.'],
  },
  {
    id: 'fac-5',
    deckId: 'facilitation',
    question: 'What four questions can guide almost any scenario discussion?',
    scenario: 'Scenario discussions are the strongest part of Week 2. You are handed Scenario B: a student seems stressed before exams and is sleeping less.',
    keyPoints: [
      'What do you notice?',
      'What assumptions might we be making?',
      'What could a supportive peer say?',
      'Would additional help be needed?',
      'Teenagers learn well through stories, and these four questions are enough to carry the discussion.',
      'Debrief with: observe before assuming, ask before concluding, refer when safety concerns exist.',
    ],
    dos: ['Say the opening line first: "We are not here to diagnose, fix, or treat people."', 'Repeat the same line to close the activity.'],
    donts: ['Do not let groups settle on a diagnosis.', 'Do not skip the "assumptions" question.'],
  },
  {
    id: 'fac-6',
    deckId: 'facilitation',
    question: 'How do you facilitate the Need-Based Peer Circle sharing rounds in Week 4?',
    scenario: 'Students have written anonymous needs on slips, you have grouped them by theme, and they have joined the group closest to their issue.',
    keyPoints: [
      'Round One (sharing): "Would anyone like to share a little more about why this issue matters to them?" Sharing is voluntary only.',
      'Group members reply only with "Thank you for sharing", "I relate to that" or "I\'ve experienced something similar". No advice yet.',
      'Round Two (reflection): which emotions are common, what similarities show up, what surprised you, what helps you feel less alone.',
      'Then run the three-column coping brainstorm: What Makes It Worse, What Helps a Little, What Helps a Lot.',
    ],
    dos: ['Keep the stage about understanding first.', 'Ask: "Who are safe people you can talk to?"'],
    donts: ['Do not let the group solve or advise in round one.', 'Do not pressure anyone to disclose.'],
  },

  // ---------- Deck 2: Youth Mental Health Literacy & 6-Week Curriculum ----------
  {
    id: 'lit-1',
    deckId: 'literacy',
    question: 'What is the Week 2 "Facilitator Bridge" on what mental health is?',
    scenario: 'Opening check-in. You asked, "When you hear the term mental health, what words or ideas come to mind?" and recorded answers on the board.',
    keyPoints: [
      'Mental health is part of being human. Everyone has mental health, just as everyone has physical health.',
      'Good mental health does not mean being happy all the time.',
      'Poor mental health does not automatically mean someone has a mental illness.',
      'It is how we think, feel and behave, how we cope, how we relate to others, and it changes over time. It is a spectrum, not all-or-nothing.',
    ],
    dos: ['Say "just as everyone has physical health, everyone has mental health".', 'Ask whether someone can have good mental health and still feel stress, grief, sadness or anxiety.'],
    donts: ['Do not say "some people have mental health and some don\'t".', 'Do not equate mental health with mental illness.'],
  },
  {
    id: 'lit-2',
    deckId: 'literacy',
    question: 'A student says, "I feel anxious before exams, so I must have an anxiety disorder." How do you respond?',
    scenario: 'Many teenagers have absorbed social-media language about mental health and label themselves quickly.',
    keyPoints: [
      'The goal is normalisation without minimising.',
      '"Feeling anxious before exams does not necessarily mean you have an anxiety disorder."',
      '"Feeling sad after a breakup does not necessarily mean depression." "Feeling stressed does not mean something is wrong with you."',
      'Anxiety becomes a concern when it is persistent, intense and interferes with daily life. A short video online cannot reliably diagnose anyone.',
    ],
    dos: ['Take the feeling seriously and use the four help-threshold questions.', 'Say difficult emotions are normal human experiences.'],
    donts: ['Do not say "you have anxiety" or "you definitely have depression".', 'Do not dismiss them with "you are overreacting".'],
  },
  {
    id: 'lit-3',
    deckId: 'literacy',
    question: 'What are the four Help Threshold questions?',
    scenario: 'You compare "I failed a test and felt terrible for three days" with "I\'ve felt hopeless every day for two months and stopped seeing friends." Students ask what is different.',
    keyPoints: [
      '1. How intense is it? Mild concern or overwhelming?',
      '2. How long has it lasted? A few days after an argument is expected. Hopeless most days for months is worth attention.',
      '3. Is it affecting daily life? Look at school, relationships, sleep, self-care and activities they usually enjoy.',
      '4. Is anyone\'s safety at risk? This is the most important question. If safety is involved, the threshold for a trusted adult is reached immediately.',
      'A help threshold is the point where a problem is serious enough, lasts long enough, or affects life enough that additional support is needed. It is not a clinical term.',
    ],
    dos: ['Use the grazed-knee analogy: clean it and watch it, but see a doctor if it is severe, not healing, or you cannot walk.', 'Shift the question from "does this person have an illness?" to "do they need more support?"'],
    donts: ['Do not use the thresholds to diagnose.', 'Do not wait for the other three questions if safety is at risk.'],
  },
  {
    id: 'lit-4',
    deckId: 'literacy',
    question: 'Apply the Help Threshold: a student has been constantly anxious for months, cannot sleep, avoids classes and is falling behind. What is your reading?',
    scenario: 'This is Example 2 from the Week 2 curriculum.',
    keyPoints: [
      'Intense: yes. Long-lasting: yes. Affecting life: yes. Safety concern: not necessarily.',
      'Help threshold: likely crossed, and additional support would be appropriate.',
      'Compare Example 1 (anxious before exams: not intense, not long-lasting, not significantly affecting life, no safety concern): probably not crossed. Friends, teachers and healthy coping may be enough.',
      'Example 3 ("I don\'t want to be here anymore", even the first time): immediately crossed, and a trusted adult should be involved.',
    ],
    dos: ['Ask for each scenario: what do you notice, what assumptions, what could a supportive peer say, is more help needed?', 'Arrange adult support for the crossed cases.'],
    donts: ['Do not treat Example 1 as an emergency.', 'Do not treat Example 3 as "just a phase".'],
  },
  {
    id: 'lit-5',
    deckId: 'literacy',
    question: 'What are the early warning signs that someone may need more support?',
    scenario: 'You are teaching students what to notice, not how to diagnose.',
    keyPoints: [
      'Pay attention when changes are noticeable, symptoms persist, functioning is affected, or safety concerns emerge.',
      'Emotional: persistent sadness, excessive worry, mood changes.',
      'Behavioural: withdrawal from friends, missing activities, sudden changes in performance.',
      'Physical: fatigue, changes in eating, changes in sleeping.',
      'Week 4 adds: distress lasting several weeks, persistent hopelessness, difficulty functioning at school, withdrawing from everyone, thoughts of self-harm.',
    ],
    dos: ['Say "observe before assuming, ask before concluding".', 'Generate the list of who to reach out to: trusted adult, parent or caregiver, teacher, school counsellor, religious leader, healthcare provider.'],
    donts: ['Do not assume a cause for what you notice.', 'Do not teach diagnostic criteria.'],
  },
  {
    id: 'lit-6',
    deckId: 'literacy',
    question: 'What are the three messages every facilitator must carry?',
    scenario: 'This is your Week 2 closing message. You want students to leave with the core of the programme.',
    keyPoints: [
      '1. Everyone has mental health.',
      '2. Struggling does not automatically mean mental illness.',
      '3. Peer support is not therapy. "We are not here to diagnose, fix, or treat people. We are here to listen, support, and help connect people with appropriate help when needed."',
      'Peer counsellors notice, listen, care and connect. Sometimes the most helpful thing is helping someone realise they do not have to struggle alone.',
    ],
    dos: ['Repeat the third message throughout every session.', 'Close with: "How do we care about someone without taking responsibility for their problems?"'],
    donts: ['Do not let peer counsellors leave thinking they are mini-therapists.', 'Do not skip the key takeaways round (one thing I learned, one myth I will challenge, one sign, one trusted adult or resource).'],
  },
  {
    id: 'lit-7',
    deckId: 'literacy',
    question: 'In the Week 4 sexuality session, how do you frame attraction, orientation and gender identity so everyone feels safe?',
    scenario: 'Your group comes from many cultural and religious backgrounds, and some students look uncomfortable.',
    keyPoints: [
      'Frame it around understanding, not agreement. Say: "We are not asking participants to change their personal, cultural, or religious beliefs. We are asking peer counsellors to understand common terms, respond respectfully to people whose experiences may differ from their own, and provide support without ridicule, shame, or exclusion."',
      'Sexuality is far broader than sexual behaviour: attraction, relationships, affection, identity, values, body image, feelings, intimacy and boundaries.',
      'Attraction can be emotional, romantic, physical, sexual or aesthetic. It is a human experience, not a moral failing or an achievement. What matters is how people act and respect boundaries.',
      'Tone is developmental, not ideological. Participants are never pressured to disclose.',
    ],
    dos: ['Teach common terms (orientation, gender identity, transgender, transition, intersex) and keep the focus on respect.', 'Use the three commitments: curiosity, respect, humility.'],
    donts: ['Do not tell anyone what identity to adopt.', 'Do not assume you can tell orientation or identity from appearance.'],
  },

  // ---------- Deck 3: Active Listening, Empathy & Peer Boundaries ----------
  {
    id: 'lis-1',
    deckId: 'listening',
    question: 'What is active listening, and what are its three parts?',
    scenario: 'Week 3. A student says, "Most people can listen. Why do we need a drill?"',
    keyPoints: [
      'Active listening is listening to understand, not to respond. Most people listen while preparing their reply.',
      '1. Paying attention: put distractions away, face the person, appropriate eye contact, notice words and emotions.',
      '2. Showing you are listening: "I see." "Go on." "That sounds difficult." "I\'m listening."',
      '3. Checking understanding: ask open questions, reflect feelings, summarise.',
      'Formula: Listen, Reflect, Clarify. Analogy: it is like holding up a mirror, not painting a new picture.',
    ],
    dos: ['Say "Sounds like you\'re feeling rejected. Has something happened recently that made you feel that way?"', 'Aim for roughly 80% listening and 20% talking.'],
    donts: ['Do not say "You should just stop worrying about it."', 'Do not retell every detail in a summary. Keep to the key facts and feelings.'],
  },
  {
    id: 'lis-2',
    deckId: 'listening',
    question: 'How do you run the Active Listening Drill?',
    scenario: 'Groups of three. The class is restless and keeps slipping into advice-giving.',
    keyPoints: [
      'Speaker talks for 2 minutes about a challenge at school, a stressful week or a goal.',
      'Listener may only ask open questions, reflect feelings and summarise.',
      'Listener may not give advice, tell their own story or interrupt.',
      'Observer looks for eye contact, open questions, reflection and no advice-giving.',
      'Rotate roles, then debrief: what felt helpful, what made you feel heard, what made you feel unheard.',
    ],
    dos: ['Rotate roles so everyone takes each part.', 'Contrast "Tell me more" with "You should..." and "Why don\'t you just...".'],
    donts: ['Do not let the observer coach mid-conversation.', 'Do not skip the debrief.'],
  },
  {
    id: 'lis-3',
    deckId: 'listening',
    question: 'Turn these closed questions into open ones: "Are you upset?", "Did your parents get angry?", "Do you have friends you can talk to?"',
    scenario: 'Week 3 assignment: students write five open and five closed questions and convert the closed ones.',
    keyPoints: [
      '"How are you feeling about what happened?"',
      '"How did your parents react?"',
      '"Who do you usually turn to when things are difficult?"',
      'Good openers: What... How... Tell me about... Can you describe... Help me understand...',
      'Avoid "Why did you do that?", "Don\'t you think you should...?" and "Why didn\'t you just...?". Try "What was going through your mind at the time?" or "What options have you considered?"',
    ],
    dos: ['Invite conversation, not interrogation.', 'Ask what support would be most helpful right now.'],
    donts: ['Do not use questions that sound open but judge or lead.', 'Do not ask for graphic detail.'],
  },
  {
    id: 'lis-4',
    deckId: 'listening',
    question: 'Explain what peer support IS and IS NOT.',
    scenario: 'A peer counsellor says, "If my friend is struggling, I must carry it all myself."',
    keyPoints: [
      'IS: listening without judgement, empathy, helping someone feel less alone, encouraging healthy coping, helping a friend seek adult support, walking alongside someone.',
      'IS NOT: therapy, giving diagnoses, keeping dangerous secrets, solving someone\'s life problems, being available 24/7, taking responsibility for another person\'s choices.',
      'Analogy: if your friend broke their leg you would not perform surgery. You stay with them and help them get assistance.',
      'Mantra: Listen. Support. Refer. Not: Listen. Fix. Rescue.',
    ],
    dos: ['Say "That sounds really difficult", "I\'m glad you told me" and "Would you like me to go with you to see the counsellor?"', 'Remind them that supporters need support too.'],
    donts: ['Do not say "I\'ll fix this" or "Don\'t tell any adults".', 'Do not encourage rescue behaviour.'],
  },
  {
    id: 'lis-5',
    deckId: 'listening',
    question: 'A friend texts a peer counsellor at midnight every night about their problems. What boundary do you coach?',
    scenario: 'Week 3, Boundary Scenario 1. The supporter is exhausted and neglecting their own wellbeing.',
    keyPoints: [
      'A boundary is a limit that helps you care about someone without taking responsibility for their life.',
      'Poor boundaries: feeling responsible for fixing friends, constant late-night crises, emotional exhaustion, neglecting your wellbeing, keeping dangerous secrets.',
      'Healthy boundaries: being supportive, knowing your limits, seeking adult help, taking breaks, looking after yourself too.',
      'Possible response: "I care about you. Let\'s talk tomorrow when I can give you my full attention."',
      'Useful phrase: "I care about you, but I don\'t think I can handle this alone."',
    ],
    dos: ['Ask: is helping important, are boundaries needed, what could you say?', 'Ask who can support the supporter after an upsetting disclosure.'],
    donts: ['Do not make yourself available 24/7.', 'Do not swallow the overwhelm and say nothing.'],
  },
  {
    id: 'lis-6',
    deckId: 'listening',
    question: 'A peer says, "I think something is wrong with me because I have a crush on another girl." What supportive responses do you model?',
    scenario: 'Week 4 sexuality session, Scenario 1. The room goes very quiet.',
    keyPoints: [
      '"Thank you for trusting me." "Many people experience different kinds of attraction." "You don\'t have to figure everything out immediately." "Would it help to talk more about what you\'re feeling?"',
      'Peer counsellors should listen, validate feelings, encourage reflection and connect peers to support when necessary.',
      'Self-understanding often develops gradually, so no one has to decide on a label immediately.',
      'Peer counsellors should not diagnose, tell people what identity to adopt, pressure toward any conclusion, or become someone\'s sole source of support.',
    ],
    dos: ['Ask "How are you feeling about it?".', 'Encourage trusted adult support when needed.'],
    donts: ['Do not tell them who they are, dismiss, mock, or spread what they said.', 'Do not break their confidence unless safety is at risk.'],
  },

  // ---------- Deck 4: Safeguarding, Red Flags & Psychologist Referral Protocol ----------
  {
    id: 'safe-1',
    deckId: 'safeguarding',
    question: 'When must confidentiality be broken?',
    scenario: 'Week 3 confidentiality session. A student says, "A good friend never tells."',
    keyPoints: [
      'Better principle: "A good friend helps keep people safe." It is not about being a snitch.',
      'Usually respect confidentiality: "I\'m stressed", "My parents are arguing", "I failed a test", "I broke up with someone".',
      'Break it when safety is at risk: "I\'m thinking of killing myself", "I\'m being abused", "Someone is hurting me", "I want to seriously hurt someone", "I don\'t feel safe at home". Also sexual abuse, rape, incest, sexual exploitation and ongoing risk of harm.',
      'Keeping a dangerous secret is different from protecting someone\'s privacy. Safety comes first.',
    ],
    dos: ['Involve the designated safeguarding adult under the programme\'s procedures.', 'Say: "I care about your safety. Because this involves harm, I need to involve someone who can help protect and support you. I will do this with as much respect and privacy as possible."'],
    donts: ['Do not promise absolute secrecy.', 'Do not handle dangerous situations alone.'],
  },
  {
    id: 'safe-2',
    deckId: 'safeguarding',
    question: 'A friend says, "Promise not to tell anyone, but I\'ve been thinking about ending my life." What does a peer counsellor do, and what do you do as facilitator?',
    scenario: 'Boundary Scenario 2 in Week 3. Students debate trust versus safety.',
    keyPoints: [
      'Safety comes first. Secrecy is not maintained.',
      'Referral formula: Listen ("That sounds really hard"), Express concern ("I\'m worried about you"), Connect ("Let\'s talk to an adult who can help").',
      'Statements like "Nothing matters anymore. I don\'t see the point" or "I don\'t want to be here anymore" cross the help threshold immediately, even on the first mention.',
      'As facilitator, follow the safeguarding procedure at once. Where a psychologist referral applies, the safeguarding lead arranges it and the facilitator does not run clinical sessions.',
      'If there is immediate danger, call 999.',
    ],
    dos: ['Stay with the student and bring in a trusted adult straight away.', 'Name who can help: school counsellor, teacher, deputy principal, boarding master or mistress, school nurse, parent, guardian, faith leader, social worker, mental health professional.'],
    donts: ['Do not leave them alone to "check later".', 'Do not decide the risk level on your own.'],
  },
  {
    id: 'safe-3',
    deckId: 'safeguarding',
    question: 'A student discloses sexual abuse, rape or incest. How does a peer counsellor respond, and what must you do?',
    scenario: 'After a Week 4 session, a student quietly tells a peer counsellor that a family member abuses them. The peer counsellor comes to you.',
    keyPoints: [
      'Stay calm, listen carefully, thank them for trusting you, tell them what happened is serious, and connect them with support.',
      'Helpful words: "Thank you for telling me." "I\'m glad you spoke up." "What happened to you is not okay." "You don\'t have to deal with this alone."',
      'Being forced, pressured or intimidated into sexual activity is never the victim\'s fault. A child or adolescent is never responsible for abuse by a family member.',
      'Follow the safeguarding procedure immediately. Do not promise secrecy.',
    ],
    dos: ['Record the facts and words used in the restricted safeguarding channel.', 'Support the peer counsellor who received the disclosure too.'],
    donts: ['Do not ask for graphic details or investigate the story yourself.', 'Do not say "Why didn\'t you stop it?", "Are you sure?" or "You should have told someone earlier".'],
  },
  {
    id: 'safe-4',
    deckId: 'safeguarding',
    question: 'What myths about sexual abuse and consent do facilitators need to correct, and what are the facts?',
    scenario: 'Students repeat "if they did not fight back, they agreed" and "friends can\'t sexually bully each other".',
    keyPoints: [
      'Consent must be freely, willingly and enthusiastically given each and every time, and can be withdrawn at any point. Silence is not consent.',
      'Fear, shock or freezing do not mean agreement. Pressure, guilt, threats and manipulation are coercion, and coercion can happen inside friendships and peer groups.',
      'Most sexual assaults are committed by someone the victim knows. Boys and men can be victims too.',
      'A person who is incapacitated, drunk or unconscious cannot give meaningful consent. Alcohol and drugs impair judgement and the ability to read boundaries.',
      'Responsibility always lies with the person who chose to commit the assault. Many survivors delay telling because of fear, shame or loyalty.',
    ],
    dos: ['Ask: why is it hard to say no, and why might someone be afraid to disclose?', 'Say: "What happened is not your fault."'],
    donts: ['Do not treat a late disclosure as proof it did not happen.', 'Do not blame clothing, behaviour or alcohol.'],
  },
  {
    id: 'safe-5',
    deckId: 'safeguarding',
    question: 'After a breakup a student talks about getting revenge and "making them regret it". What is your response?',
    scenario: 'Week 4, Part 2. A student is angry, humiliated and says they will spread photos and turn friends against an ex.',
    keyPoints: [
      'Feelings are normal and real. Harmful actions are choices. You have a right to your feelings, not a right to harm someone because of them.',
      'Harmful: threatening, harassing, seeking revenge, destroying property, spreading rumours or private information (verbal, written or video), isolating completely, numbing with alcohol or drugs.',
      'Healthy: talking to trusted friends, journalling, exercise, prayer, a psychotherapist or counselling psychologist, supportive people, time to heal.',
      'Respect continues after a relationship ends. Rejection is not proof you are unlovable.',
      'If a student mentions self-harm or a threat to another person, treat it as a safety concern and escalate.',
    ],
    dos: ['Ask "What will I do with this anger?".', 'Remind them that friends help us be our best selves, not our worst.'],
    donts: ['Do not encourage "getting even".', 'Do not ignore threats or sharing of private content.'],
  },
  {
    id: 'safe-6',
    deckId: 'safeguarding',
    question: 'Which signs mean you must act immediately, and how do you hand over to the psychologist referral pathway?',
    scenario: 'During Week 4 circles, a participant shares experiences involving self-harm. You are the facilitator in the room.',
    keyPoints: [
      'Facilitator caution: self-harm, suicidal thoughts, abuse, sexual exploitation, serious neglect and threats to safety all trigger the safeguarding process.',
      'Do not promise secrecy. Follow the programme\'s safeguarding and referral procedures immediately.',
      'Route: facilitator, designated safeguarding adult, Daraja wellness team and outsourced psychologist. The psychologist decides the clinical pathway.',
      'Warm handover: what was said, the risk level, what has been done. Tell the student who will contact them.',
      'Support lines: Childline Kenya 116 and Kenya Red Cross 1199. For immediate danger call 999.',
    ],
    dos: ['Complete the facilitator debrief: were any referrals needed, who seemed isolated or distressed?', 'Record only facts, in the restricted channel.'],
    donts: ['Do not diagnose or run therapy in school.', 'Do not keep disclosures on personal phones or WhatsApp groups.'],
  },

  // ---------- Deck 5: Daraja Operations, Attendance & Session Standards ----------
  {
    id: 'ops-1',
    deckId: 'operations',
    question: 'How is the Week 2 session structured, with timings?',
    scenario: 'You are planning Week 2 on a ninety-minute slot and want to hold the time.',
    keyPoints: [
      'Welcome and check-in: 10 minutes.',
      'What mental health is and isn\'t (mini lesson): 15 minutes.',
      'Myth vs Fact activity: 15 minutes.',
      'Common mental health challenges overview: 15 minutes.',
      'Early warning signs and help thresholds: 15 minutes.',
      'Scenario discussions: 15 minutes. Anonymous question box: 5 to 10 minutes. Key takeaways: 5 minutes.',
    ],
    dos: ['Keep the opening and closing lines word for word.', 'Run the myths with the Week 2 Doc 2 facilitator sheet.'],
    donts: ['Do not skip the anonymous question box.', 'Do not turn the overview into diagnostic teaching.'],
  },
  {
    id: 'ops-2',
    deckId: 'operations',
    question: 'How does the Week 3 "Foundations of Peer Support" session run?',
    scenario: 'You are about to open Week 3 and want to cover the key skills without rushing the boundaries section.',
    keyPoints: [
      'Check-in (5 minutes): one word for how you feel, or a highlight and a challenge. Sharing is voluntary.',
      'Order: what peer support is and isn\'t, active listening (with the drill), emotional boundaries, confidentiality and its limits, referral pathways, boundary scenarios.',
      'Boundaries are the most important part of the session.',
      'Assignments: active listening challenge, advice vs listening journal, open-ended question practice, boundary reflection, and a "Listen, Support, Refer" exercise.',
      'Key take-home: a good peer supporter listens, cares and connects people to help. They are not a counsellor, therapist, rescuer or secret-keeper when safety is at risk.',
    ],
    dos: ['Tell students journals can stay private if confidentiality is a concern.', 'Repeat "Listen. Support. Refer." throughout.'],
    donts: ['Do not rush the boundaries and confidentiality sections.', 'Do not turn assignments into taking responsibility for others\' wellbeing.'],
  },
  {
    id: 'ops-3',
    deckId: 'operations',
    question: 'How does the Week 4 Need-Based Peer Circles session flow?',
    scenario: 'You prepare the room and your co-facilitator asks what the plan is.',
    keyPoints: [
      'Opening and grounding (10 minutes), then review group agreements: respectful listening, confidentiality, disagreeing respectfully.',
      'Activity 1: identify current needs on anonymous slips (10 to 15 minutes). Activity 2: group by theme (10 minutes).',
      'Activity 3: guided peer sharing (25 to 30 minutes). Activity 4: collective coping brainstorm (20 minutes).',
      'Teaching moment: the help threshold (5 minutes). Then signs you may need additional support, who to reach out to, and closing reflection (10 minutes).',
      'The optional sexuality session sits within Week 4 and is need-based.',
    ],
    dos: ['Prepare in advance: active listening, validation versus advice, confidentiality, referral procedures, signs of need.', 'End with: one thing I learned, one strategy I am taking, one person I can reach out to.'],
    donts: ['Do not try to solve anyone\'s problem.', 'Do not run the sexuality session without the safeguarding and framing notes.'],
  },
  {
    id: 'ops-4',
    deckId: 'operations',
    question: 'What does the facilitator debrief cover after every session?',
    scenario: 'Students have left. You have ten minutes before you also leave the school.',
    keyPoints: [
      'Which needs appeared most frequently?',
      'Were there students who seemed isolated or distressed?',
      'What strengths emerged within the group?',
      'Were any referrals needed?',
      'What themes should be considered in future sessions?',
    ],
    dos: ['Do the debrief the same day.', 'Pass referrals to the safeguarding lead before you leave.'],
    donts: ['Do not carry a concern alone until next week.', 'Do not share student details outside the restricted channel.'],
  },
  {
    id: 'ops-5',
    deckId: 'operations',
    question: 'Explain the QR attendance rules to a new facilitator.',
    scenario: 'A co-facilitator asks whether they can send the code to a student who was marked absent.',
    keyPoints: [
      'The challenge is one-time, short-lived (about sixty seconds) and can only be redeemed once.',
      'Display it while the student is physically present and scanning.',
      'Manual token entry is the fallback when a camera does not work.',
      'Attendance is tied to the signed-in user. There is no proxy check-in.',
      'Online sessions: use a private room link, no recording without consent, and never hold a private one-to-one video call with a student.',
    ],
    dos: ['Generate the challenge when the room is ready to scan.', 'Use the manual token when a phone camera fails.'],
    donts: ['Do not share the token on WhatsApp or in a class group.', 'Do not back-fill attendance for absent students.'],
  },
];
