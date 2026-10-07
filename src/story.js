// Venezuela Rabbit Hole — branching city adventure
//
// Nodes are deliberately data-driven. A node may:
//   text, delay, next, expects, timeout, hint, tag, end, sceneEvent
//
// Every visit builds a different route through three of four districts. Choices
// set flags that later nodes inspect, so consequences are physical and narrative.

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

function nextDistrict(state) {
  state._districtIndex = (state._districtIndex || 0) + 1;
  if (state._districtIndex >= state._districtPlan.length) return 'finale';
  return 'cityMap';
}

function finishDistrict(state, district) {
  state._visited[district] = true;
  state._districtIndex = (state._districtIndex || 0) + 1;
  return state._districtIndex >= state._districtPlan.length ? 'finale' : 'cityMap';
}

function fightOutcome(state, win, winNode, loseNode) {
  state._fights = (state._fights || 0) + 1;
  state._reputation = (state._reputation || 0) + (win ? 2 : -1);
  state._fightWins = (state._fightWins || 0) + (win ? 1 : 0);
  return win ? winNode : loseNode;
}

function finalNode(state) {
  if ((state._riotSaved || 0) > 0 && state._reputation > 1) return 'end_hero';
  if ((state._riotSaved || 0) > 0) return 'end_survivor';
  if (state._fights && state._fightWins === 0) return 'end_wounded';
  if (state._missing) return 'end_missing';
  return pick(['end_open', 'end_return']);
}

export const STORY = {
  start: {
    text: 'The plaza is already moving when you arrive. A brass note bends around the seawall, a child is chalking a map onto the tiles, and the old capybara-faced man at the lamp presses a folded city plan into your hand. "Do not ask me what this place means," he says. "Go find out what it needs."',
    delay: 4, next: 'cityMap', tag: '🌅 arrival',
  },

  cityMap: {
    text: (state) => {
      const left = state._districtPlan.length - state._districtIndex;
      return `The city opens in three directions. You have ${left} district${left === 1 ? '' : 's'} left on this visit. The market is shouting, the docks are flashing signal lights, the hill barrio is beating a warning on empty drums, and the old train station is full of locked doors. Where do you go?`;
    },
    expects: {
      GO_MARKET: 'market_intro',
      GO_DOCKS: 'docks_intro',
      GO_BARRIO: 'barrio_intro',
      GO_STATION: 'station_intro',
    },
    timeout: { sec: 30, goto: 'market_intro' },
    hint: '(M market, D docks, B barrio, S station)',
    tag: '🗺️ choose a district',
  },

  market_intro: {
    text: 'The market has lost its electricity. Vendors hold phone lights under their faces while a little girl named Luz searches between overturned crates for her brother Tomas. A shopkeeper points at a masked thief disappearing into the alleys. You can chase the thief, stay with Luz, or take the stolen medicine back by force.',
    expects: { CHASE: 'market_chase', HELP: 'market_help', FIGHT: 'market_fight' },
    timeout: { sec: 28, goto: 'market_help' },
    hint: '(C chase, E stay with Luz, F take it back)',
    tag: '🥭 market in the dark',
  },
  market_chase: {
    text: 'You run through mango crates and wet cobbles. The thief drops the medicine at a locked gate, but Tomas is crying on the other side. Do you break the gate, or leave the medicine and climb after the thief?',
    expects: { BREAK: 'market_break', CLIMB: 'market_climb' },
    timeout: { sec: 22, goto: 'market_break' },
    hint: '(X break the gate, L climb after the thief)',
  },
  market_break: {
    text: 'The gate gives way. Tomas comes out clutching the medicine, and the thief vanishes into the rain. Luz will remember the sound of your shoulder hitting metal. The market gives you a red scarf and a name: "When the city calls, answer loudly."',
    delay: 4, next: (state) => { state._marketSaved = true; state._reputation = (state._reputation || 0) + 1; return finishDistrict(state, 'market'); },
    tag: '🧒 Tomas found',
  },
  market_climb: {
    text: 'You climb. The thief is faster, but you catch a glimpse of the medicine being passed through a window to an old woman upstairs. It was never a theft; it was a delivery the market could not wait for. You return with an apology and a pocket full of mangoes.',
    delay: 4, next: (state) => { state._marketTruth = true; return finishDistrict(state, 'market'); },
    tag: '🥭 truth behind the chase',
  },
  market_help: {
    text: 'You kneel beside Luz and use the phone light to make a trail of stars through the stalls. Tomas answers from beneath a flour table. The medicine is gone, but the siblings are together. Someone in the crowd quietly hands you a brass key.',
    delay: 4, next: (state) => { state._marketSaved = true; state._brassKey = true; return finishDistrict(state, 'market'); },
    tag: '⭐ siblings reunited',
  },
  market_fight: {
    text: 'You corner the masked stranger beside the fish stall. They swing first. This is not a metaphor and it is not safe. You have one chance to stand your ground.',
    expects: { FIGHT: 'market_fight_result' },
    timeout: { sec: 12, goto: 'market_fight_result' },
    hint: '(F fight)',
    sceneEvent: 'FIGHT_START',
  },
  market_fight_result: {
    text: 'The market explodes into motion. Stalls tip, people shout, and your shoes slide on the wet stones.',
    delay: 1,
    next: (state) => fightOutcome(state, Math.random() < 0.5, 'market_win', 'market_loss'),
    tag: '🥊 market fight',
  },
  market_win: {
    text: 'You win by luck, not strength. The medicine skids free and Tomas gets it. Your knuckles hurt, but the market starts chanting your name. The masked stranger leaves behind a silver token stamped with a station number.',
    delay: 4, next: (state) => { state._marketSaved = true; state._stationToken = true; return finishDistrict(state, 'market'); },
    sceneEvent: 'FIGHT_WIN', tag: '🏅 won the market',
  },
  market_loss: {
    text: 'You lose. The stranger catches your wrist, whispers "Not every rescue is yours," and disappears with the medicine. Luz finds Tomas herself. You walk away bruised, carrying the shame and a new suspicion about the old station.',
    delay: 4, next: (state) => { state._marketLost = true; return finishDistrict(state, 'market'); },
    sceneEvent: 'FIGHT_LOSS', tag: '🩸 lost the market',
  },

  docks_intro: {
    text: 'At the docks, a fishing boat is burning without sinking. Captain Yara is trapped below deck with a crate of letters from people who left the city. The harbor master wants the boat cut loose before the fire reaches the fuel drums. Yara begs you to save the letters first.',
    expects: { RESCUE: 'docks_rescue', CUT_LOOSE: 'docks_cut', STEAL: 'docks_steal' },
    timeout: { sec: 28, goto: 'docks_cut' },
    hint: '(E rescue Yara, X cut the boat loose, T take the letters)',
    tag: '⚓ burning docks',
    sceneEvent: 'DOCKS_FIRE',
  },
  docks_rescue: {
    text: 'Smoke turns the hold into a maze. You find Yara, but the letters are under a fallen mast. Save the captain now, or crawl for the memories while the ceiling groans?',
    expects: { SAVE: 'docks_saved', LETTERS: 'docks_letters' },
    timeout: { sec: 18, goto: 'docks_saved' },
    hint: '(E save Yara, L take the letters)',
  },
  docks_saved: {
    text: 'You drag Yara over the rail as the hold collapses. She lives. The letters burn, and for the rest of the night the harbor is full of people trying to remember what they said in them.',
    delay: 4, next: (state) => { state._yaraSaved = true; return finishDistrict(state, 'docks'); },
    sceneEvent: 'DOCKS_COLLAPSE', tag: '🔥 captain saved',
  },
  docks_letters: {
    text: 'You crawl for the letters. Yara gets herself out, furious and alive, while you save a single dry bundle. It contains a map to a quiet road out of the city and three unfinished goodbyes.',
    delay: 4, next: (state) => { state._letters = true; state._escapeMap = true; return finishDistrict(state, 'docks'); },
    sceneEvent: 'DOCKS_COLLAPSE', tag: '✉️ letters saved',
  },
  docks_cut: {
    text: 'You cut the moorings. The burning boat drifts beyond the fuel drums and blooms into a second sun on the water. Yara is safe on the pier, but every letter is lost. The harbor master gives you a radio that still works on one frequency.',
    delay: 4, next: (state) => { state._radio = true; return finishDistrict(state, 'docks'); },
    sceneEvent: 'DOCKS_EXPLOSION', tag: '🚤 fire at sea',
  },
  docks_steal: {
    text: 'You take the letter crate and run. At the end of the pier you open it: every page is blank. The real letters were in Yara’s coat. She watches you realize it and says nothing.',
    delay: 4, next: (state) => { state._missing = true; return finishDistrict(state, 'docks'); },
    tag: '📭 empty letters',
  },

  barrio_intro: {
    text: 'The hill barrio is holding a midnight vigil when the first bottle breaks. A rumor says the police are coming, another says the water tanks were poisoned, and a third says the train station is hiding people. The crowd is frightened enough to become dangerous. You can help organize an escape route, expose the rumor, or join the people building barricades.',
    expects: { ORGANIZE: 'barrio_route', EXPOSE: 'barrio_expose', RIOT: 'barrio_riot' },
    timeout: { sec: 28, goto: 'barrio_route' },
    hint: '(O organize, E expose the rumor, R join the barricades)',
    tag: '⛰️ hill vigil',
  },
  barrio_route: {
    text: 'You lead families through a laundry alley toward the old school. Halfway down, a child is missing and the crowd behind you is surging. Return for the child, or keep the route open for everyone else?',
    expects: { RETURN: 'barrio_child', KEEP: 'barrio_escape' },
    timeout: { sec: 20, goto: 'barrio_escape' },
    hint: '(E return, K keep the route open)',
  },
  barrio_child: {
    text: 'You turn back. The child is hiding inside a water tank, shaking but alive. By the time you return, the crowd has scattered and the school is empty. You saved one life and lost the neighborhood’s trust in your plan.',
    delay: 4, next: (state) => { state._childSaved = true; return finishDistrict(state, 'barrio'); },
    tag: '🧒 one life',
  },
  barrio_escape: {
    text: 'You keep the route open. Forty people reach the school, but the missing child is not among them. At dawn, a small handprint appears on the gate from the inside.',
    delay: 4, next: (state) => { state._riotSaved = (state._riotSaved || 0) + 1; state._crowdSaved = true; return finishDistrict(state, 'barrio'); },
    tag: '🚪 many lives',
  },
  barrio_expose: {
    text: 'You climb onto a roof and shout until the rumor breaks apart. The tanks are clean. The train station is hiding nobody. Then a real siren answers from below, and the crowd realizes the danger was never imaginary.',
    delay: 3, next: 'barrio_riot', sceneEvent: 'RIOT_START', tag: '📣 rumor broken',
  },
  barrio_riot: {
    text: 'The riot arrives all at once: shutters slam, fireworks become stones, and the colorful buildings tremble under the crowd’s feet. A three-story facade starts to fold toward a family trapped in the street. You can run to them, or pull the barricade down and open an escape lane.',
    expects: { RESCUE: 'riot_rescue', OPEN: 'riot_open' },
    timeout: { sec: 18, goto: 'riot_open' },
    hint: '(E rescue the family, O open the lane)',
    sceneEvent: 'RIOT_START',
  },
  riot_rescue: {
    text: 'You run into the dust. The facade collapses behind you, bricks hammering the street, but you get the family through a doorway. The barrio will call you brave. You know you were only late by one second.',
    delay: 4, next: (state) => { state._riotSaved = (state._riotSaved || 0) + 1; return finishDistrict(state, 'barrio'); },
    sceneEvent: 'BUILDING_COLLAPSE', tag: '🏚️ family pulled free',
  },
  riot_open: {
    text: 'You wrench the barricade apart. The lane opens and the crowd pours through before the facade comes down. Nobody knows who made the opening. You leave with dust in your mouth and a city that can still move.',
    delay: 4, next: (state) => { state._riotSaved = (state._riotSaved || 0) + 1; return finishDistrict(state, 'barrio'); },
    sceneEvent: 'BUILDING_COLLAPSE', tag: '💨 escape lane',
  },

  station_intro: {
    text: 'The old station is quiet except for a radio behind a locked ticket window. The frequency repeats a child’s name and a departure time from twenty years ago. Your brass key or silver token might open the service door. Otherwise, someone inside is asking you to knock three times.',
    expects: { ENTER: 'station_inside', KNOCK: 'station_knock', LEAVE: 'station_leave' },
    timeout: { sec: 26, goto: 'station_knock' },
    hint: '(E enter, K knock, L leave)',
    tag: '🚂 old station',
  },
  station_inside: {
    text: 'The door opens onto a platform that should not fit inside the building. A train waits without a driver. On its first carriage is a wall of photographs, including one of Luz, Yara, and the child from the hill — years younger. Take the train, or tear down the photographs and end the loop?',
    expects: { BOARD: 'station_board', END_LOOP: 'station_end' },
    timeout: { sec: 22, goto: 'station_end' },
    hint: '(B board the train, X end the loop)',
  },
  station_board: {
    text: 'The train moves through darkness and returns one minute later. You step off carrying a warm stone engraved with your own name. Somewhere outside, a person you helped remembers you before you have met them.',
    delay: 4, next: (state) => { state._train = true; state._reputation = (state._reputation || 0) + 2; return finishDistrict(state, 'station'); },
    sceneEvent: 'TRAIN_DEPART', tag: '🪨 impossible train',
  },
  station_end: {
    text: 'You tear the photographs down. The radio stops. The station becomes an ordinary ruin, and the city loses a door it may have needed. In the quiet, you find a note: "Some loops are lifeboats."',
    delay: 4, next: (state) => { state._loopEnded = true; return finishDistrict(state, 'station'); },
    tag: '🕯️ loop ended',
  },
  station_knock: {
    text: 'You knock three times. A voice asks for the name of someone you failed. When you answer, the ticket window opens onto a dark room and a single paper ticket. It is dated tomorrow.',
    delay: 4, next: (state) => { state._ticket = true; return finishDistrict(state, 'station'); },
    tag: '🎫 tomorrow’s ticket',
  },
  station_leave: {
    text: 'You leave the station alone. Behind you, the radio changes from a child’s name to yours. The city has noticed that you chose not to know.',
    delay: 4, next: (state) => { state._missing = true; return finishDistrict(state, 'station'); },
    tag: '📻 unanswered',
  },

  finale: {
    text: (state) => {
      const clues = [
        state._marketSaved && 'Tomas is alive',
        state._yaraSaved && 'Yara is waiting at the harbor',
        state._riotSaved && 'the hill is still standing',
        state._train && 'the impossible train is moving',
        state._letters && 'the letters survived',
      ].filter(Boolean).join(', ');
      return `At dawn you return to the plaza. The old man unfolds your map. ${clues || 'The city keeps its secrets'}. He asks whether you are ready to leave with what you changed, or stay and see what changes next.`;
    },
    expects: { LEAVE: 'final_result', STAY: 'final_result' },
    hint: '(L leave the city, E stay with it)',
    tag: '🌄 dawn',
  },
  final_result: {
    text: (state) => state._finalChoice === 'stay'
      ? 'You stay. The plaza fills with people whose stories now overlap yours. There is no clean ending, only a city that has made room for one more witness.'
      : 'You leave. At the seawall, the map redraws itself behind you. You cannot tell whether the city is shrinking or following.',
    delay: 5, next: finalNode, tag: '🧭 final choice',
  },
  end_hero: {
    text: 'You did not save everyone. You did save enough for the city to remember your shape. When the next siren sounds, three doors open before you reach them.',
    delay: 3, end: true, tag: '✨ remembered',
  },
  end_survivor: {
    text: 'The city is bruised, breathing, and still yours for one night. You leave with dust in your pockets and the strange knowledge that survival is a kind of authorship.',
    delay: 3, end: true, tag: '🌬️ survivor',
  },
  end_wounded: {
    text: 'You leave before the lamps go out. Every step hurts, but the city has stopped pretending courage means winning. Somewhere, someone you met is carrying what you could not.',
    delay: 3, end: true, tag: '🩹 wounded',
  },
  end_missing: {
    text: 'You reach the seawall and find one place on the map completely blank. You know you lost something there. The city refuses to tell you whether it can be found again.',
    delay: 3, end: true, tag: '⬜ missing',
  },
  end_open: {
    text: 'The old man folds the map around the names you collected. "Come back," he says. Behind him, every road is lit differently. No two visits will ask the same thing of you.',
    delay: 3, end: true, tag: '🌙 open road',
  },
  end_return: {
    text: 'You return to the seawall with no answer, only consequences: a saved child, a burned boat, a door left open. The city is not a riddle. It is a living argument, and you have entered it.',
    delay: 3, end: true, tag: '🔁 return',
  },
};

export const START_NODE = 'start';

export function prepareVisit(state) {
  state._districtPlan = shuffle(['market', 'docks', 'barrio', 'station']).slice(0, 3);
  state._districtIndex = 0;
  state._visited = {};
  state._reputation = 0;
  state._fights = 0;
  state._fightWins = 0;
}
