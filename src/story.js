// Venezuela Rabbit Hole — story data
//
// Data-driven state machine. Each node can have:
//   text      – what the character says (plain string)
//   next      – next node id, OR a function (state) => nodeId for random/conditional routing
//   delay     – seconds to wait before auto-advancing to `next`
//   expects   – map of EVENT -> nodeId, waiting for a visitor action instead of auto-advancing
//   timeout   – { sec, goto }  if no action arrives in time
//   hint      – nudge shown if the visitor stalls
//   tag       – short emoji/label recorded on the path
//   end       – marks the final node
//
// Every visit is unique:
//   - one of three opening lines
//   - three of four questions, in a random order
//   - each stance (SURRENDER / FIGHT) picks a random reaction line
//   - the object segment reacts to whichever of four items is given
//   - the ending depends on the visitor's overall stance
//
// The visitor's two stances:
//   SURRENDER = stay / hold on / open up   (key 1)
//   FIGHT     = push back / guard / leave  (key 2)
// Object events (keys now, camera later):
//   GAVE_CUATRO (3)  GAVE_MARACAS (4)  GAVE_AREPA (5)  GAVE_BOOK (6)
//
// NOTE: keep all cultural details light and warm. If we present any real
// statistic or named figure, check it against a source before the exhibition.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The question pool. Each visit asks a random 3 of the 4, in random order.
// q  = question node id,  s = surrender-answer line,  f = fight-answer line
const QUESTIONS = [
  { q: 'q_cara',   s: ['q_cara_s1', 'q_cara_s2', 'q_cara_s3'], f: ['q_cara_f1', 'q_cara_f2', 'q_cara_f3'] },
  { q: 'q_money',  s: ['q_money_s1', 'q_money_s2', 'q_money_s3'], f: ['q_money_f1', 'q_money_f2', 'q_money_f3'] },
  { q: 'q_home',   s: ['q_home_s1', 'q_home_s2', 'q_home_s3'], f: ['q_home_f1', 'q_home_f2', 'q_home_f3'] },
  { q: 'q_migra',  s: ['q_migra_s1', 'q_migra_s2', 'q_migra_s3'], f: ['q_migra_f1', 'q_migra_f2', 'q_migra_f3'] },
];

const NUM_QUESTIONS = 3;

// Build this visit's plan: three random questions in random order.
function makePlan(state) {
  const chosen = shuffle(QUESTIONS).slice(0, NUM_QUESTIONS);
  state._plan = chosen;
  state._qi = 0;
  state._sur = 0;
  state._fig = 0;
  return chosen[0].q;
}

// Record the stance, then route to the next question (or the object segment).
function answerNext(state, stance) {
  if (stance === 'surrender') state._sur += 1;
  else state._fig += 1;
  state._qi += 1;
  if (state._qi < NUM_QUESTIONS) return state._plan[state._qi].q;
  return 'objIntro';
}

// Which answer line node for this stance.
function answerNode(state, stance) {
  const cur = state._plan[state._qi];
  return pick(stance === 'surrender' ? cur.s : cur.f);
}

// Which closing ending, from the overall stance.
function endingFor(state) {
  const sur = state._sur || 0;
  const fig = state._fig || 0;
  if (sur > fig) return pick(['end_stay1', 'end_stay2']);
  if (fig > sur) return pick(['end_leave1', 'end_leave2']);
  return pick(['end_between1', 'end_between2']);
}

export const STORY = {
  // ---------- Opening ----------
  start: {
    text: 'You step onto the plaza. The turquoise sea glints under a bright blue sky, the bougainvillea is spilling pink and red over the colorful houses, and an old man is looking right at you. He has been waiting.',
    delay: 4,
    next: (state) => (state._open = pick(['open1', 'open2', 'open3'])),
    tag: '🌅 arrival',
  },
  open1: {
    text: 'So. You found this little hole in the world. Sit, sit — the arepa seller just finished a batch and the drums are about to start. Tell me, what do you feel when you see this place?',
    delay: 2, next: 'q_start',
  },
  open2: {
    text: 'Mmm. The sun is doing that thing it does right before it drops. I was just thinking about the road — the long one, you know the one. What is on your mind right now?',
    delay: 2, next: 'q_start',
  },
  open3: {
    text: 'A visitor! I love a visitor. I have seen a thousand faces come up this seawall, but yours is new. Let me tell you something, and then you tell me something back. Deal?',
    delay: 2, next: 'q_start',
  },

  q_start: { text: '', delay: 0, next: (s) => makePlan(s) },

  // ---------- Questions ----------
  q_cara: {
    text: 'My grandmother used to say a country lives in its little details — the color of the flag on the pole, the way the light lands on the water. When you think of a place like this, what do you want to hold onto? The people, or the memory of it?',
    expects: { SURRENDER: 'a_cara_s', FIGHT: 'a_cara_f' },
    timeout: { sec: 24, goto: 'a_cara_s' },
    hint: '(Hold on, or push back?)',
    tag: '🏳️ memory',
  },
  q_money: {
    text: 'You know, the money here gets lighter every year — the same bill, less weight in your hand. People learned to count in hope instead of coins. If your pockets held nothing, what would you spend first: your pride, or your rest?',
    expects: { SURRENDER: 'a_money_s', FIGHT: 'a_money_f' },
    timeout: { sec: 24, goto: 'a_money_f' },
    hint: '(Give in, or guard yourself?)',
    tag: '💵 lighter coin',
  },
  q_home: {
    text: 'The mountains are far behind these hills, but this town is all sea — heat, drum, salt. Some people carry both halves and never let go. If you could keep only one, which would you take: the silence up high, or the noise down by the water?',
    expects: { SURRENDER: 'a_home_s', FIGHT: 'a_home_f' },
    timeout: { sec: 24, goto: 'a_home_s' },
    hint: '(Open up, or hold back?)',
    tag: '⛰️ two halves',
  },
  q_migra: {
    text: 'Half the families I know have someone walking a border right now — a cousin, a brother, a whole childhood. They say home follows you in your pocket. Is it heavy to carry a country, or do you ever wish it would let you down?',
    expects: { SURRENDER: 'a_migra_s', FIGHT: 'a_migra_f' },
    timeout: { sec: 24, goto: 'a_migra_s' },
    hint: '(Carry it, or set it down?)',
    tag: '🧳 the long road',
  },

  // Answer routers (zero-length: instantly pick a random line for the stance).
  a_cara_s:  { text: '', delay: 0, next: (s) => answerNode(s, 'surrender') },
  a_cara_f:  { text: '', delay: 0, next: (s) => answerNode(s, 'fight') },
  a_money_s: { text: '', delay: 0, next: (s) => answerNode(s, 'surrender') },
  a_money_f: { text: '', delay: 0, next: (s) => answerNode(s, 'fight') },
  a_home_s:  { text: '', delay: 0, next: (s) => answerNode(s, 'surrender') },
  a_home_f:  { text: '', delay: 0, next: (s) => answerNode(s, 'fight') },
  a_migra_s: { text: '', delay: 0, next: (s) => answerNode(s, 'surrender') },
  a_migra_f: { text: '', delay: 0, next: (s) => answerNode(s, 'fight') },

  // Question 1 lines — memory
  q_cara_s1: { text: 'Yes… the people. The memory fades into the people. Stay close to them and the whole country stays alive.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '💙 people' },
  q_cara_s2: { text: 'Mm. You hold the memory in your mouth like sugar. Sweet, and gone too fast. That is the honest answer.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🍬 kept' },
  q_cara_s3: { text: 'Good. The sea does not apologize for being what it is. Neither should you.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🌊 unapologetic' },
  q_cara_f1: { text: 'Huh. You want to push the memory aside. Fine — memories can be heavy, heavier than luggage.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🧳 set down' },
  q_cara_f2: { text: 'Careful. Push it too hard and it floats away. But I respect the ones who would rather face the road than the past.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🚪 road' },
  q_cara_f3: { text: 'So you guard it, then. Lock the door, keep the key small. I know that look. I wore it for years.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🔒 guarded' },

  // Question 2 lines — money
  q_money_s1: { text: 'Pride first, always. The rest can be borrowed. A country that keeps its pride keeps its name.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🦁 pride' },
  q_money_s2: { text: 'Ah, and the rest? Mm. Rest is a luxury we invented so we would not feel the weight. Clever of us.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '😌 rest' },
  q_money_s3: { text: 'The sea keeps no coins. Only tides. You are learning the oldest way to be poor and still rich.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🌊 tides' },
  q_money_f1: { text: 'Pride, then. Guard it like the last arepa in the pan. I will not tell you I am surprised.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🫓 last arepa' },
  q_money_f2: { text: 'You would rather run than kneel. The road is long, but your legs look good for it.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🏃 running' },
  q_money_f3: { text: 'Mm. Neither, then. You keep the bill folded in your pocket and count nothing. That is a very modern answer.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🤫 counting nothing' },

  // Question 3 lines — two halves
  q_home_s1: { text: 'The silence up high. Mm. You are the type who keeps the mountains in the basement of the heart — cold, and always there.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '⛰️ kept' },
  q_home_s2: { text: 'The noise down by the water. Good. This town will take care of you. It has nowhere else to put its love.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🥁 noise' },
  q_home_s3: { text: 'You take both halves at once. The mountains and the sea, side by side. That is the whole country in one body.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🗺️ both' },
  q_home_f1: { text: 'Neither. You want to stand in between and own no half. The border people do that. I understand.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🚧 in between' },
  q_home_f2: { text: 'You push the sea back. It comes right around. But it is worth the try, and I respect the try.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🌊 pushed back' },
  q_home_f3: { text: 'So you leave the choice open. Smart. The ones who decide everything end up deciding the wrong things.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🌀 undecided' },

  // Question 4 lines — migration
  q_migra_s1: { text: 'Yes, it is heavy. But the pocket is where we keep what matters. A country in the pocket is a country that will not get lost.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🪙 in the pocket' },
  q_migra_s2: { text: 'Mm. Carry it, and let it warm your chest. A cold country in the pocket is just weight. A warm one is family.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '🔥 warm' },
  q_migra_s3: { text: 'It is heavy, and you want it lighter. That is the whole question, and you answered both halves. Rare.', delay: 3, next: (s) => answerNext(s, 'surrender'), tag: '⚖️ both halves' },
  q_migra_f1: { text: 'Set it down, then. The road is long and your shoulders deserve rest. Some people carry the country for a while and then, finally, set it down.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '😮‍💨 set down' },
  q_migra_f2: { text: 'You wish it would let you go. Mm. I know that wish. It is the oldest wish on every border.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '🕊️ wish to go' },
  q_migra_f3: { text: 'You want to cut the thread. Careful — it is tied to something in your chest you have not named yet.', delay: 3, next: (s) => answerNext(s, 'fight'), tag: '✂️ thread cut' },

  // ---------- Object segment ----------
  objIntro: { text: '', delay: 0, next: (s) => (s._oi = pick(['objIntro1', 'objIntro2', 'objIntro3'])) },
  objIntro1: {
    text: 'Now the last thing, and I do not mean the last thing in time. On that little table by the lamp — there is a cuatro, a pair of maracas, a fresh arepa, and a notebook. If you give me one of them, I will tell you what you are, in my words. Choose.',
    delay: 2, next: 'object',
  },
  objIntro2: {
    text: 'Come. See? By the lamp, I keep four little gifts: a cuatro, maracas, an arepa, a notebook. Each one is a person, you know. Give me the one that sounds like you and I will tell you who that person is.',
    delay: 2, next: 'object',
  },
  objIntro3: {
    text: 'The table by the lamp has four things on it. A guitar. A rattle. A bread. A book. My grandmother said: whatever you give to the stranger at the end of the day, that is who you are. Pick one, or give me none. Both are answers.',
    delay: 2, next: 'object',
  },

  object: {
    text: '',
    expects: {
      GAVE_CUATRO: 'o_cuatro',
      GAVE_MARACAS: 'o_maracas',
      GAVE_AREPA: 'o_arepa',
      GAVE_BOOK: 'o_book',
    },
    timeout: { sec: 25, goto: 'obj_timeout' },
    hint: '(Give me the four, the rattle, the bread, or the book — or give me nothing.)',
  },

  obj_timeout: {
    text: 'Ah. No gift. That is also an answer. Some people keep everything, and some people give nothing, and some people give themselves. You are the first kind, or the last one. I cannot tell, and I will not ask.',
    delay: 4,
    next: (s) => endingFor(s),
    tag: '🤫 nothing given',
  },

  // Object reactions — each picks one of two lines, then to the ending.
  o_cuatro: { text: '', delay: 0, next: (s) => pick(['cuatro1', 'cuatro2']) },
  cuatro1: {
    text: 'The four strings, the old shape. You gave me the guitar. You are the person who hums before the words arrive. A songwriter with no songs yet — or a hundred, just not written down. Sit, I will play you the one your grandmother would have known.',
    delay: 5, next: (s) => endingFor(s), tag: '🎸 the hummer',
  },
  cuatro2: {
    text: 'A four-string! The old shape, the long-necked one. Mm. You are the type who remembers in melodies. When a day is good, you do not say it — you sing it, quietly, so only the sea hears.',
    delay: 5, next: (s) => endingFor(s), tag: '🎵 melody keeper',
  },

  o_maracas: { text: '', delay: 0, next: (s) => pick(['maracas1', 'maracas2']) },
  maracas1: {
    text: 'Rattle, rattle — you gave me the maracas. You are the one who shakes the room open. You do not wait for the music; you start it. Every party has one like you, and without you the party is just a room.',
    delay: 5, next: (s) => endingFor(s), tag: '🪇 the opener',
  },
  maracas2: {
    text: 'Ah, the two little rattlers. You are the type who cannot sit still. If the ground stops shaking, you are the one who shakes it back. A good sign. A very good sign.',
    delay: 5, next: (s) => endingFor(s), tag: '🥁 restless heart',
  },

  o_arepa: { text: '', delay: 0, next: (s) => pick(['arepa1', 'arepa2']) },
  arepa1: {
    text: 'A fresh arepa. You gave me bread. You are the type who feeds people before you feed yourself. Quiet, sturdy, warm in the middle. The kind of person a whole family builds its evening around and never says so.',
    delay: 5, next: (s) => endingFor(s), tag: '🫓 the feeder',
  },
  arepa2: {
    text: 'The arepa — the honest one. No frills, just corn and salt and patience. You are the type who shows up and does the work. The others take the pictures; you hold the line.',
    delay: 5, next: (s) => endingFor(s), tag: '💪 the steady one',
  },

  o_book: { text: '', delay: 0, next: (s) => pick(['book1', 'book2']) },
  book1: {
    text: 'A notebook. You gave me a book. You are the type who writes things down before the world forgets them. Careful with that habit — one day you will read back what you wrote, and the stranger on the page will look back at you.',
    delay: 5, next: (s) => endingFor(s), tag: '📖 the writer',
  },
  book2: {
    text: 'The book. Mm. You keep your country in letters, not in your pocket. The pocket gets wet. The letters do not. You will be the one they ask to write the story, and you will say yes, and you will write it right.',
    delay: 5, next: (s) => endingFor(s), tag: '✍️ the story-keeper',
  },

  // ---------- Endings ----------
  end_stay1: {
    text: 'The sun is gone. The lamp over the plaza is up. You came here with nothing, and you are leaving with a little weight in your chest. That weight has a name, and you will say it out loud tomorrow, and it will be true. Go in peace. Come back to the hole whenever the sea turns that color.',
    delay: 3, end: true, tag: '🌙 stayed',
  },
  end_stay2: {
    text: 'The drums are starting now, and you stayed the whole time. Mm. The hole is smaller on the inside than it is on the outside. That is the trick of it. Keep the door open. Keep the sea in your pocket. Come back to the hole whenever the light lands like that.',
    delay: 3, end: true, tag: '🌙 held on',
  },
  end_leave1: {
    text: 'The sun is gone. You pushed back three times, and the sea pushed back once, and it was enough. Walk the long road. The hole will be here, and the lamp will be up, and the arepa will be warm. You do not have to stay. You only have to not forget.',
    delay: 3, end: true, tag: '🚪 left',
  },
  end_leave2: {
    text: 'You are already looking for the exit, and I do not mind. The road is long and your legs look good for it. Take a piece of the light with you — it fits in a pocket, and it does not weigh anything. Come back to the hole when you are ready. The hole is patient.',
    delay: 3, end: true, tag: '🚪 on the road',
  },
  end_between1: {
    text: 'You held on twice and pushed back twice, and the sea held on three times and pushed back three, and we are even. That is the honest kind of even. The hole is a place for even people. Come back when the light lands like that. The lamp will be up.',
    delay: 3, end: true, tag: '⚖️ in between',
  },
  end_between2: {
    text: 'Neither staying nor leaving, exactly. You are the type who stands on the seawall and lets the wave do the deciding. The wave decides it wants you here a little longer. So do I. Go now, but slowly. The hole is patient.',
    delay: 3, end: true, tag: '⚖️ on the wall',
  },
};

export const START_NODE = 'start';
