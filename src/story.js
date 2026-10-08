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
    text: 'The plaza is alive. The capybara keeper hands you a city map: "Choose a place, and help someone." You will live with the result.',
    delay: 4, next: 'cityMap', tag: '🌅 arrival',
  },

  cityMap: {
    text: (state) => {
      const left = state._districtPlan.length - state._districtIndex;
      const choices = state._districtPlan.map((district) => ({
        market: 'market',
        docks: 'docks',
        barrio: 'hill barrio',
        station: 'old station',
      }[district]));
      return `${left} place${left === 1 ? '' : 's'} remain — Left: ${choices[0]}, Center: ${choices[1]}, Right: ${choices[2]}. Where do you go?`;
    },
    expects: {
      GO_MARKET: 'market_intro',
      GO_DOCKS: 'docks_intro',
      GO_BARRIO: 'barrio_intro',
      GO_STATION: 'station_intro',
    },
    timeout: { sec: 30, goto: 'market_intro' },
    hint: '(Move left, stay centered, or move right)',
    tag: '🗺️ choose a district',
  },

  market_intro: {
    text: 'The market is dark. Luz cannot find Tomas, and a masked stranger has the medicine. Chase them, help Luz, or fight for it.',
    expects: { CHASE: 'market_chase', HELP: 'market_help', FIGHT: 'market_fight' },
    timeout: { sec: 28, goto: 'market_help' },
    hint: '(C chase, E stay with Luz, F take it back)',
    tag: '🥭 market in the dark',
  },
  market_chase: {
    text: 'The stranger drops the medicine. Tomas is behind a locked gate. Break it, or keep chasing?',
    expects: { BREAK: 'market_break', CLIMB: 'market_climb' },
    timeout: { sec: 22, goto: 'market_break' },
    hint: '(X break the gate, L climb after the thief)',
  },
  market_break: {
    text: 'You break the gate. Tomas gets the medicine. The market gives you a red scarf and remembers your courage.',
    delay: 4, next: (state) => { state._marketSaved = true; state._reputation = (state._reputation || 0) + 1; return finishDistrict(state, 'market'); },
    tag: '🧒 Tomas found',
  },
  market_climb: {
    text: 'You climb after the stranger. It was not a theft; the medicine was being delivered to an old woman. You return with an apology.',
    delay: 4, next: (state) => { state._marketTruth = true; return finishDistrict(state, 'market'); },
    tag: '🥭 truth behind the chase',
  },
  market_help: {
    text: 'You help Luz search, and Tomas is hiding under a flour table. The medicine is gone, but the siblings are safe. Someone gives you a brass key.',
    delay: 4, next: (state) => { state._marketSaved = true; state._brassKey = true; return finishDistrict(state, 'market'); },
    tag: '⭐ siblings reunited',
  },
  market_fight: {
    text: 'You corner the stranger. They swing first. Stand your ground.',
    expects: { FIGHT: 'market_fight_result' },
    timeout: { sec: 12, goto: 'market_fight_result' },
    hint: '(F fight)',
    sceneEvent: 'FIGHT_START',
  },
  market_fight_result: {
    text: 'The market erupts. Stalls fall, and people shout. Your fight begins now.',
    delay: 1,
    next: (state) => fightOutcome(state, Math.random() < 0.5, 'market_win', 'market_loss'),
    tag: '🥊 market fight',
  },
  market_win: {
    text: 'You win. Tomas gets the medicine. Your knuckles hurt, and the stranger leaves a silver station token.',
    delay: 4, next: (state) => { state._marketSaved = true; state._stationToken = true; return finishDistrict(state, 'market'); },
    sceneEvent: 'FIGHT_WIN', tag: '🏅 won the market',
  },
  market_loss: {
    text: 'You lose. The medicine is gone. Luz finds Tomas, while you leave bruised and suspicious of the old station.',
    delay: 4, next: (state) => { state._marketLost = true; return finishDistrict(state, 'market'); },
    sceneEvent: 'FIGHT_LOSS', tag: '🩸 lost the market',
  },

  docks_intro: {
    text: 'A fishing boat burns at the docks. Captain Yara is trapped below, with letters from people who left. Rescue her, cut the boat loose, or take the letters.',
    expects: { RESCUE: 'docks_rescue', CUT_LOOSE: 'docks_cut', STEAL: 'docks_steal' },
    timeout: { sec: 28, goto: 'docks_cut' },
    hint: '(E rescue Yara, X cut the boat loose, T take the letters)',
    tag: '⚓ burning docks',
    sceneEvent: 'DOCKS_FIRE',
  },
  docks_rescue: {
    text: 'You find Yara. The letters are trapped under a mast. Save her, or save the letters?',
    expects: { SAVE: 'docks_saved', LETTERS: 'docks_letters' },
    timeout: { sec: 18, goto: 'docks_saved' },
    hint: '(E save Yara, L take the letters)',
  },
  docks_saved: {
    text: 'You save Yara. The hold collapses and the letters burn. She will remember you.',
    delay: 4, next: (state) => { state._yaraSaved = true; return finishDistrict(state, 'docks'); },
    sceneEvent: 'DOCKS_COLLAPSE', tag: '🔥 captain saved',
  },
  docks_letters: {
    text: 'You save the letters. Yara escapes, angry but alive. One bundle contains a map out of the city.',
    delay: 4, next: (state) => { state._letters = true; state._escapeMap = true; return finishDistrict(state, 'docks'); },
    sceneEvent: 'DOCKS_COLLAPSE', tag: '✉️ letters saved',
  },
  docks_cut: {
    text: 'You cut the boat loose, and the fire drifts away from the fuel. Yara lives, but every letter is lost. The harbor master gives you a radio.',
    delay: 4, next: (state) => { state._radio = true; return finishDistrict(state, 'docks'); },
    sceneEvent: 'DOCKS_EXPLOSION', tag: '🚤 fire at sea',
  },
  docks_steal: {
    text: 'You steal the letter crate, but every page is blank. The real letters were with Yara. She says nothing.',
    delay: 4, next: (state) => { state._missing = true; return finishDistrict(state, 'docks'); },
    tag: '📭 empty letters',
  },

  barrio_intro: {
    text: 'The hill barrio is afraid. Rumors spread, bottles break, and the crowd may riot. Organize an escape, expose the rumor, or join the barricades.',
    expects: { ORGANIZE: 'barrio_route', EXPOSE: 'barrio_expose', RIOT: 'barrio_riot' },
    timeout: { sec: 28, goto: 'barrio_route' },
    hint: '(O organize, E expose the rumor, R join the barricades)',
    tag: '⛰️ hill vigil',
  },
  barrio_route: {
    text: 'You lead families to the school. A child is missing. Go back, or keep the escape route open?',
    expects: { RETURN: 'barrio_child', KEEP: 'barrio_escape' },
    timeout: { sec: 20, goto: 'barrio_escape' },
    hint: '(E return, K keep the route open)',
  },
  barrio_child: {
    text: 'You find the child alive inside a water tank. The crowd scatters, but you save one life.',
    delay: 4, next: (state) => { state._childSaved = true; return finishDistrict(state, 'barrio'); },
    tag: '🧒 one life',
  },
  barrio_escape: {
    text: 'You keep the route open. Many reach safety, but the child is missing. At dawn, a small handprint appears inside the school.',
    delay: 4, next: (state) => { state._riotSaved = (state._riotSaved || 0) + 1; state._crowdSaved = true; return finishDistrict(state, 'barrio'); },
    tag: '🚪 many lives',
  },
  barrio_expose: {
    text: 'You expose the rumor, and the tanks are clean. Then a real siren sounds. The danger is real.',
    delay: 3, next: 'barrio_riot', sceneEvent: 'RIOT_START', tag: '📣 rumor broken',
  },
  barrio_riot: {
    text: 'The riot begins. Buildings shake, stones fly, and a facade falls toward a trapped family. Rescue them, or open an escape lane.',
    expects: { RESCUE: 'riot_rescue', OPEN: 'riot_open' },
    timeout: { sec: 18, goto: 'riot_open' },
    hint: '(E rescue the family, O open the lane)',
    sceneEvent: 'RIOT_START',
  },
  riot_rescue: {
    text: 'You run through the dust and pull the family free. The building collapses one second later.',
    delay: 4, next: (state) => { state._riotSaved = (state._riotSaved || 0) + 1; return finishDistrict(state, 'barrio'); },
    sceneEvent: 'BUILDING_COLLAPSE', tag: '🏚️ family pulled free',
  },
  riot_open: {
    text: 'You open the lane. The crowd escapes before the facade collapses. The city can still move.',
    delay: 4, next: (state) => { state._riotSaved = (state._riotSaved || 0) + 1; return finishDistrict(state, 'barrio'); },
    sceneEvent: 'BUILDING_COLLAPSE', tag: '💨 escape lane',
  },

  station_intro: {
    text: 'The old station is empty except for a radio. It repeats a child’s name and tomorrow’s departure. Enter, knock, or leave.',
    expects: { ENTER: 'station_inside', KNOCK: 'station_knock', LEAVE: 'station_leave' },
    timeout: { sec: 26, goto: 'station_knock' },
    hint: '(E enter, K knock, L leave)',
    tag: '🚂 old station',
  },
  station_inside: {
    text: 'The door opens onto an impossible platform. A driverless train waits beside photographs of people you met, years younger. Board it, or end the loop?',
    expects: { BOARD: 'station_board', END_LOOP: 'station_end' },
    timeout: { sec: 22, goto: 'station_end' },
    hint: '(B board the train, X end the loop)',
  },
  station_board: {
    text: 'The train returns one minute later. You carry a warm stone with your name on it. Someone remembers you before meeting you.',
    delay: 4, next: (state) => { state._train = true; state._reputation = (state._reputation || 0) + 2; return finishDistrict(state, 'station'); },
    sceneEvent: 'TRAIN_DEPART', tag: '🪨 impossible train',
  },
  station_end: {
    text: 'You tear down the photographs, and the radio stops. The station becomes an ordinary ruin. One note remains: some loops are lifeboats.',
    delay: 4, next: (state) => { state._loopEnded = true; return finishDistrict(state, 'station'); },
    tag: '🕯️ loop ended',
  },
  station_knock: {
    text: 'You knock three times. A voice asks for someone you failed. The window opens onto a ticket dated tomorrow.',
    delay: 4, next: (state) => { state._ticket = true; return finishDistrict(state, 'station'); },
    tag: '🎫 tomorrow’s ticket',
  },
  station_leave: {
    text: 'You leave. The radio changes from the child’s name to yours. The city noticed.',
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
      return `At dawn, you return to the plaza. ${clues || 'The city keeps its secrets'}. Leave, or stay and see what changes next?`;
    },
    expects: { LEAVE: 'final_result', STAY: 'final_result' },
    hint: '(L leave the city, E stay with it)',
    tag: '🌄 dawn',
  },
  final_result: {
    text: (state) => state._finalChoice === 'stay'
      ? 'You stay. The city makes room for one more witness.'
      : 'You leave. At the seawall, the map redraws itself behind you.',
    delay: 5, next: finalNode, tag: '🧭 final choice',
  },
  end_hero: {
    text: 'You did not save everyone. You saved enough for the city to remember you. Three doors open when the next siren sounds.',
    delay: 3, end: true, tag: '✨ remembered',
  },
  end_survivor: {
    text: 'The city is bruised but alive. You leave with dust in your pockets and a story that belongs to you.',
    delay: 3, end: true, tag: '🌬️ survivor',
  },
  end_wounded: {
    text: 'You leave before dark. Every step hurts. Someone you met carries what you could not.',
    delay: 3, end: true, tag: '🩹 wounded',
  },
  end_missing: {
    text: 'At the seawall, one place on your map is blank. You lost something there. The city will not say what.',
    delay: 3, end: true, tag: '⬜ missing',
  },
  end_open: {
    text: 'The keeper folds your map. "Come back," he says. Every road is lit differently — no visit is the same.',
    delay: 3, end: true, tag: '🌙 open road',
  },
  end_return: {
    text: 'You return with consequences: a saved child, a burned boat, and an open door. The city is alive, and you are part of it.',
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
