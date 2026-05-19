const rounds = Array.from({ length: 20 }, (_, index) => index + 58);

const collectionLabels = {
  0: '선사 시대',
  1: '여러 나라의 성장',
  2: '삼국 시대',
  3: '남북국 & 후삼국 시대',
  4: '고려 시대',
  5: '조선 전기',
  6: '조선 후기',
  7: '개항기 & 대한제국',
  8: '일제강점기',
  9: '현대',
};

const state = {
  availableRounds: new Map(),
  currentRound: null,
  currentData: null,
  currentCollection: 'all',
};

const els = {
  roundButtons: document.getElementById('roundButtons'),
  collectionButtons: document.getElementById('collectionButtons'),
  questionNav: document.getElementById('questionNav'),
  questionList: document.getElementById('questionList'),
  statusText: document.getElementById('statusText'),
  summary: document.getElementById('summary'),
};

init();

async function init() {
  renderRoundButtons();
  await detectAvailableRounds();
  renderRoundButtons();

  const firstAvailable = rounds.find((round) => state.availableRounds.get(round));
  if (firstAvailable) {
    await loadRound(firstAvailable);
  } else {
    setStatus('사용 가능한 JSON 파일이 없습니다.');
  }
}

function renderRoundButtons() {
  els.roundButtons.innerHTML = '';

  for (const round of rounds) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = round;
    button.disabled = state.availableRounds.has(round) && !state.availableRounds.get(round);
    button.classList.toggle('active', state.currentRound === round);
    button.title = button.disabled
      ? `json/history_data_${round}.json 파일이 없습니다.`
      : `${round}회 보기`;
    button.addEventListener('click', () => loadRound(round));
    els.roundButtons.append(button);
  }
}

async function detectAvailableRounds() {
  setStatus('58-77회 JSON 파일을 확인하는 중입니다.');

  await Promise.all(rounds.map(async (round) => {
    const ok = await jsonExists(round);
    state.availableRounds.set(round, ok);
  }));
}

async function jsonExists(round) {
  try {
    const response = await fetch(jsonPath(round), { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

async function loadRound(round) {
  if (state.availableRounds.has(round) && !state.availableRounds.get(round)) return;

  setStatus(`${round}회 데이터를 불러오는 중입니다.`);
  state.currentRound = round;
  state.currentCollection = 'all';
  renderRoundButtons();

  try {
    const response = await fetch(jsonPath(round), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.currentData = await response.json();
    state.availableRounds.set(round, true);
    renderRoundButtons();
    renderCollections();
    renderQuestionNav();
    renderQuestions();
    setStatus(`${round}회 데이터를 표시 중입니다.`);
  } catch (error) {
    state.currentData = null;
    state.availableRounds.set(round, false);
    renderRoundButtons();
    renderEmpty(`json/history_data_${round}.json 파일을 읽을 수 없습니다.`);
    setStatus(`${round}회 JSON 파일이 없습니다.`);
  }
}

function renderCollections() {
  els.collectionButtons.innerHTML = '';
  const questions = getQuestions();
  const collections = [...new Set(questions.map((item) => item.question.collection))]
    .filter((value) => value !== undefined && value !== null)
    .sort((a, b) => Number(a) - Number(b));

  addCollectionButton('all', `전체 ${questions.length}`);
  for (const collection of collections) {
    const count = questions.filter((item) => String(item.question.collection) === String(collection)).length;
    addCollectionButton(String(collection), `${getCollectionLabel(collection)} ${count}`);
  }
}

function addCollectionButton(value, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.classList.toggle('active', state.currentCollection === value);
  button.addEventListener('click', () => {
    state.currentCollection = value;
    renderCollections();
    renderQuestionNav();
    renderQuestions();
  });
  els.collectionButtons.append(button);
}

function renderQuestionNav() {
  els.questionNav.innerHTML = '';

  for (const item of getFilteredQuestions()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.number;
    button.addEventListener('click', () => {
      document.getElementById(`question-${item.number}`)?.scrollIntoView({ block: 'start' });
    });
    els.questionNav.append(button);
  }
}

function renderQuestions() {
  const questions = getFilteredQuestions();
  els.questionList.innerHTML = '';

  if (!questions.length) {
    renderEmpty('선택한 collection에 문제가 없습니다.');
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of questions) {
    fragment.append(renderQuestionCard(item.number, item.question));
  }
  els.questionList.append(fragment);

  const total = getQuestions().length;
  const shown = questions.length;
  els.summary.textContent = `${state.currentRound}회 · ${shown}/${total}문항`;
}

function renderQuestionCard(number, question) {
  const card = document.createElement('article');
  card.className = 'question-card';
  card.id = `question-${number}`;

  const answer = String(question['정답'] ?? '');
  const ai = question.answer_details?.ai_explanation ?? {};

  card.append(
    createMeta(number, question, answer),
    createTitle(question.question),
  );

  if (question.sub_question) {
    card.append(createTextBlock('p', 'sub-question', question.sub_question));
  }

  card.append(createImageBlock(question));
  card.append(createChoices(question.choices, answer));
  card.append(createExplanation(ai));

  return card;
}

function createMeta(number, question, answer) {
  const meta = document.createElement('div');
  meta.className = 'question-meta';
  meta.append(
    createBadge(`${number}번`),
    createBadge(`Score ${question.score ?? '-'}`),
    createBadge(`정답 ${answer || '-'}`, 'answer'),
    createBadge(getCollectionLabel(question.collection), 'collection'),
  );
  return meta;
}

function createTitle(text) {
  const title = document.createElement('h2');
  title.className = 'question-title';
  title.textContent = text || '질문 없음';
  return title;
}

function createImageBlock(question) {
  const wrap = document.createElement('figure');
  wrap.className = 'question-image-wrap';

  const filename = question.image_path?.edited;
  if (!filename) {
    wrap.append(createTextBlock('figcaption', 'image-missing', '이미지 없음'));
    return wrap;
  }

  const image = document.createElement('img');
  image.className = 'question-image';
  image.loading = 'lazy';
  image.alt = '문제 이미지';
  image.src = `assets/${state.currentRound}/${filename}`;
  image.addEventListener('error', () => {
    wrap.innerHTML = '';
    wrap.append(createTextBlock('figcaption', 'image-missing', `이미지를 찾을 수 없습니다: ${filename}`));
  }, { once: true });
  wrap.append(image);
  return wrap;
}

function createChoices(choices, answer) {
  const list = document.createElement('ol');
  list.className = 'choices';

  for (const [key, value] of Object.entries(choices ?? {}).sort(([a], [b]) => Number(a) - Number(b))) {
    const item = document.createElement('li');
    item.className = 'choice';
    item.classList.toggle('correct', String(key) === answer);

    const number = document.createElement('span');
    number.className = 'choice-number';
    number.textContent = key;

    const text = document.createElement('span');
    text.textContent = value;

    item.append(number, text);
    list.append(item);
  }

  return list;
}

function createExplanation(ai) {
  const section = document.createElement('section');
  section.className = 'explanation';

  const material = document.createElement('div');
  material.append(createHeading('자료해설'), createTextBlock('p', '', ai['자료해설'] || 'AI 자료해설 없음'));
  section.append(material);

  const choiceDetails = ai['선지해설'];
  if (choiceDetails && typeof choiceDetails === 'object') {
    const detailWrap = document.createElement('div');
    detailWrap.append(createHeading('선지해설'));

    const list = document.createElement('dl');
    list.className = 'choice-explanations';

    for (const [key, value] of Object.entries(choiceDetails).sort(([a], [b]) => Number(a) - Number(b))) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = key;
      const desc = document.createElement('dd');
      desc.textContent = value;
      row.append(term, desc);
      list.append(row);
    }

    detailWrap.append(list);
    section.append(detailWrap);
  }

  return section;
}

function getQuestions() {
  const questions = state.currentData?.questions ?? {};
  return Object.entries(questions)
    .map(([number, question]) => ({ number: Number(number), question }))
    .sort((a, b) => a.number - b.number);
}

function getFilteredQuestions() {
  const questions = getQuestions();
  if (state.currentCollection === 'all') return questions;
  return questions.filter((item) => String(item.question.collection) === state.currentCollection);
}

function renderEmpty(message) {
  els.questionList.innerHTML = '';
  const empty = document.createElement('section');
  empty.className = 'empty-state';
  empty.append(createTextBlock('strong', '', message));
  els.questionList.append(empty);
  els.summary.textContent = '';
}

function createBadge(text, extraClass = '') {
  const badge = document.createElement('span');
  badge.className = `badge ${extraClass}`.trim();
  badge.textContent = text;
  return badge;
}

function createHeading(text) {
  const heading = document.createElement('h3');
  heading.textContent = text;
  return heading;
}

function createTextBlock(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function jsonPath(round) {
  return `json/history_data_${round}.json`;
}

function getCollectionLabel(collection) {
  if (collection === undefined || collection === null || collection === '') return 'Collection -';
  return collectionLabels[collection] ?? `Collection ${collection}`;
}

function setStatus(text) {
  els.statusText.textContent = text;
}
