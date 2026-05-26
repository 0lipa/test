const firstRound = 58;
const lastRound = 78;
const rounds = Array.from({ length: lastRound - firstRound + 1 }, (_, index) => index + firstRound);

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
  allRoundData: new Map(),
  currentRound: null,
  currentData: null,
  currentCollection: 'all',
  currentEra: 'all',
  eraViewLoaded: false,
};

const els = {
  eraViewButton: document.getElementById('eraViewButton'),
  eraModal: document.getElementById('eraModal'),
  eraModalClose: document.getElementById('eraModalClose'),
  eraModalSummary: document.getElementById('eraModalSummary'),
  eraTabs: document.getElementById('eraTabs'),
  eraContent: document.getElementById('eraContent'),
  roundButtons: document.getElementById('roundButtons'),
  collectionButtons: document.getElementById('collectionButtons'),
  questionNav: document.getElementById('questionNav'),
  questionList: document.getElementById('questionList'),
  statusText: document.getElementById('statusText'),
  summary: document.getElementById('summary'),
};

init();

async function init() {
  setupEraModal();
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
  setStatus(`${firstRound}-${lastRound}회 JSON 파일을 확인하는 중입니다.`);

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
    state.allRoundData.set(round, state.currentData);
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

function setupEraModal() {
  els.eraViewButton.addEventListener('click', openEraModal);
  els.eraModalClose.addEventListener('click', closeEraModal);
  els.eraModal.addEventListener('click', (event) => {
    if (event.target === els.eraModal) closeEraModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.eraModal.classList.contains('hidden')) closeEraModal();
  });
}

async function openEraModal() {
  els.eraModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  renderEraLoading();

  await loadAllRounds();
  state.currentEra = 'all';
  renderEraView();
}

function closeEraModal() {
  els.eraModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function renderEraLoading() {
  els.eraModalSummary.textContent = '전체 회차 데이터를 불러오는 중입니다.';
  els.eraTabs.innerHTML = '';
  els.eraContent.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'era-empty';
  loading.textContent = '시대별 목록을 준비하고 있습니다.';
  els.eraContent.append(loading);
}

async function loadAllRounds() {
  if (state.eraViewLoaded) return;

  const loadableRounds = rounds.filter((round) => state.availableRounds.get(round));
  await Promise.all(loadableRounds.map(async (round) => {
    if (state.allRoundData.has(round)) return;

    try {
      const response = await fetch(jsonPath(round), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      state.allRoundData.set(round, data);
    } catch {
      state.availableRounds.set(round, false);
    }
  }));

  state.eraViewLoaded = true;
}

function renderEraView() {
  const items = getAllQuestions();
  const groups = getEraGroups(items);
  const underlinedItems = items.filter((item) => isUnderlinedQuestion(item.question));
  const bogiItems = items.filter((item) => isBogiQuestion(item.question));
  const currentItems = getCurrentEraItems(items, groups, underlinedItems, bogiItems);

  renderEraTabs(items, groups, underlinedItems, bogiItems);
  renderEraContent(currentItems);

  const roundCount = state.allRoundData.size;
  els.eraModalSummary.textContent = `전체 ${roundCount}개 회차 · ${items.length}문항`;
}

function renderEraTabs(items, groups, underlinedItems, bogiItems) {
  els.eraTabs.innerHTML = '';
  addEraTab('all', `전체 ${items.length}`);
  addEraTab('underlined', `밑줄 문제 ${underlinedItems.length}`);
  addEraTab('bogi', `보기 문제 ${bogiItems.length}`);

  for (const [era, eraItems] of groups) {
    addEraTab(era, `${getCollectionLabel(era)} ${eraItems.length}`);
  }
}

function getCurrentEraItems(items, groups, underlinedItems, bogiItems) {
  if (state.currentEra === 'all') return items;
  if (state.currentEra === 'underlined') return underlinedItems;
  if (state.currentEra === 'bogi') return bogiItems;
  return groups.get(state.currentEra) ?? [];
}

function addEraTab(value, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.classList.toggle('active', state.currentEra === value);
  button.addEventListener('click', () => {
    state.currentEra = value;
    renderEraView();
  });
  els.eraTabs.append(button);
}

function renderEraContent(items) {
  els.eraContent.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'era-empty';
    empty.textContent = '표시할 문제가 없습니다.';
    els.eraContent.append(empty);
    return;
  }

  const groupedByRound = groupItemsByRound(items);
  const fragment = document.createDocumentFragment();

  for (const [round, roundItems] of groupedByRound) {
    const section = document.createElement('section');
    section.className = 'era-round-group';

    const heading = document.createElement('h3');
    heading.textContent = `${round}회`;
    section.append(heading);

    const list = document.createElement('div');
    list.className = 'era-question-list';

    for (const item of roundItems) {
      list.append(createEraQuestionCard(item));
    }

    section.append(list);
    fragment.append(section);
  }

  els.eraContent.append(fragment);
}

function createEraQuestionCard(item) {
  const card = document.createElement('article');
  card.className = 'era-question-card';

  const meta = document.createElement('span');
  meta.className = 'era-question-meta';
  meta.textContent = `${item.round}회 · ${item.number}번 · ${getCollectionLabel(item.question.collection)}`;

  const title = document.createElement('h4');
  title.className = 'era-question-title';
  title.textContent = item.question.question || '질문 없음';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'era-jump-button';
  button.textContent = '문항 보기';
  button.addEventListener('click', () => jumpToQuestion(item.round, item.number));

  card.append(
    meta,
    title,
    createEraQuestionImage(item),
    createEraChoices(item.question),
    button,
  );
  return card;
}

function createEraQuestionImage(item) {
  const wrap = document.createElement('figure');
  wrap.className = 'era-question-image-wrap';

  const filename = item.question.image_path?.edited;
  if (!filename) {
    wrap.append(createTextBlock('figcaption', 'era-image-missing', '이미지 없음'));
    return wrap;
  }

  const image = document.createElement('img');
  image.className = 'era-question-image';
  image.loading = 'lazy';
  image.alt = `${item.round}회 ${item.number}번 문제 이미지`;
  setImageSourceWithFallback(image, item.round, filename, () => {
    wrap.innerHTML = '';
    wrap.append(createTextBlock('figcaption', 'era-image-missing', `이미지를 찾을 수 없습니다: ${filename}`));
  });
  wrap.append(image);
  return wrap;
}

function createEraChoices(question) {
  const list = document.createElement('ol');
  list.className = 'era-choices';

  const choices = getChoices(question);
  const choiceImages = question.image_path?.choices ?? {};

  for (const [key, value] of Object.entries(choices).sort(([a], [b]) => Number(a) - Number(b))) {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'era-choice-number';
    number.textContent = key;

    const content = document.createElement('span');
    content.textContent = choiceImages[key] ? `선택지 이미지 ${key}` : value;

    item.append(number, content);
    list.append(item);
  }

  if (!list.children.length) {
    const item = document.createElement('li');
    item.textContent = '선택지 없음';
    list.append(item);
  }

  return list;
}

async function jumpToQuestion(round, number) {
  closeEraModal();
  await loadRound(round);
  await waitForImagesBeforeQuestion(number);
  scrollToQuestion(number);
  window.setTimeout(() => scrollToQuestion(number), 250);
  window.setTimeout(() => scrollToQuestion(number), 900);
}

function scrollToQuestion(number) {
  document.getElementById(`question-${number}`)?.scrollIntoView({ block: 'start' });
}

function waitForImagesBeforeQuestion(number) {
  const target = document.getElementById(`question-${number}`);
  if (!target) return Promise.resolve();

  const cards = [...els.questionList.querySelectorAll('.question-card')];
  const targetIndex = cards.indexOf(target);
  const cardsToTarget = targetIndex >= 0 ? cards.slice(0, targetIndex + 1) : [target];
  const images = cardsToTarget.flatMap((card) => [...card.querySelectorAll('img')]);

  return Promise.all(images.map((image) => {
    image.loading = 'eager';
    if (image.complete) return Promise.resolve();

    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }));
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
    renderEmpty('선택한 시대에 문제가 없습니다.');
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

  const answer = getAnswer(question);
  const ai = question.answer_details?.ai_explanation ?? {};

  card.append(
    createMeta(number, question, answer),
    createTitle(question.question),
  );

  card.append(createImageBlock(question));
  card.append(createChoices(question, answer));
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
  setImageSourceWithFallback(image, state.currentRound, filename, () => {
    wrap.innerHTML = '';
    wrap.append(createTextBlock('figcaption', 'image-missing', `이미지를 찾을 수 없습니다: ${filename}`));
  });
  wrap.append(image);
  return wrap;
}

function createChoices(question, answer) {
  const list = document.createElement('ol');
  list.className = 'choices';
  const choices = getChoices(question);
  const choiceImages = question.image_path?.choices ?? {};

  for (const [key, value] of Object.entries(choices).sort(([a], [b]) => Number(a) - Number(b))) {
    const item = document.createElement('li');
    item.className = 'choice';
    item.classList.toggle('correct', String(key) === answer);

    const number = document.createElement('span');
    number.className = 'choice-number';
    number.textContent = key;

    const content = document.createElement('span');
    content.className = 'choice-content';

    if (choiceImages[key]) {
      const image = document.createElement('img');
      image.className = 'choice-image';
      image.alt = `${key}번 선택지`;
      setImageSourceWithFallback(image, state.currentRound, choiceImages[key], () => {
        content.textContent = `선택지 이미지를 찾을 수 없습니다: ${choiceImages[key]}`;
      });
      content.append(image);
    } else {
      content.textContent = value;
    }

    item.append(number, content);
    list.append(item);
  }

  return list;
}

function getChoices(question) {
  const choices = question.choices ?? {};
  const imageChoices = question.image_path?.choices ?? {};
  if (question.image === true && Object.keys(imageChoices).length) return imageChoices;
  if (Object.keys(choices).length) return choices;
  return imageChoices;
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

function getAllQuestions() {
  return [...state.allRoundData.entries()]
    .flatMap(([round, data]) => {
      const questions = data?.questions ?? {};
      return Object.entries(questions).map(([number, question]) => ({
        round,
        number: Number(number),
        question,
      }));
    })
    .sort((a, b) => a.round - b.round || a.number - b.number);
}

function getEraGroups(items) {
  const groups = new Map();
  const eras = [...new Set(items.map((item) => getCollectionKey(item.question.collection)))]
    .sort(compareCollectionKeys);

  for (const era of eras) {
    groups.set(era, items.filter((item) => getCollectionKey(item.question.collection) === era));
  }

  return groups;
}

function isUnderlinedQuestion(question) {
  const title = question.question ?? '';
  const subQuestion = question.sub_question ?? '';
  return Boolean(question.underlined_text) || title.includes('밑줄 그은') || subQuestion.includes('밑줄 그은');
}

function isBogiQuestion(question) {
  const text = [
    question.question,
    question.sub_question,
    ...Object.values(question.choices ?? {}),
  ].join(' ');
  const normalized = text.replace(/\s+/g, '');

  return normalized.includes('<보기>')
    || normalized.includes('〈보기〉')
    || normalized.includes('&lt;보기&gt;');
}

function groupItemsByRound(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.round)) groups.set(item.round, []);
    groups.get(item.round).push(item);
  }
  return groups;
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

function getAnswer(question) {
  return String(question.answer ?? question['정답'] ?? '');
}

function setImageSourceWithFallback(image, round, filename, onMissing) {
  image.src = getAssetPath(round, filename);
  image.addEventListener('error', () => {
    const basename = filename.split('/').pop();
    if (!image.dataset.fallbackTried && basename && basename !== filename) {
      image.dataset.fallbackTried = 'true';
      image.src = getAssetPath(round, basename);
      return;
    }

    onMissing();
  });
}

function getAssetPath(round, filename) {
  return `assets/${round}/${filename}`;
}

function jsonPath(round) {
  return `json/history_data_${round}.json`;
}

function getCollectionLabel(collection) {
  if (getCollectionKey(collection) === 'unclassified') return '시대 미분류';
  return collectionLabels[collection] ?? `시대 ${collection}`;
}

function getCollectionKey(collection) {
  if (collection === undefined || collection === null || collection === '') return 'unclassified';
  return String(collection);
}

function compareCollectionKeys(a, b) {
  if (a === 'unclassified') return 1;
  if (b === 'unclassified') return -1;
  return Number(a) - Number(b);
}

function setStatus(text) {
  els.statusText.textContent = text;
}
