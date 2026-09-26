const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('beginner assistant is wired into the authenticated application shell', () => {
  const index = read('index.html');
  const app = read('app.js');
  const loader = read('data/route-loader.js');
  assert.doesNotMatch(index, /beginner-learning-assistant\.css\?v=2/);
  assert.match(loader, /beginner-learning-assistant\.css\?v=2/);
  assert.match(loader, /data\/beginner-learning-assistant\.js\?v=3/);
  for (const route of ['learning-path', 'learning-progress', 'beginner-vocabulary-review', 'beginner-vocabulary-session']) {
    assert.match(app, new RegExp(`['"]${route}['"]`));
    assert.match(loader, new RegExp(route));
  }
});

test('home, learning path and progress use stored learning evidence', () => {
  const source = read('data/beginner-learning-assistant.js');
  assert.match(source, /getUserProgress/);
  assert.match(source, /PracticeService\?\.getHistory/);
  assert.match(source, /StudyCalendarService\?\.activityByDay/);
  assert.match(source, /lessonProgress/);
  assert.match(source, /wordsLearned/);
  assert.match(source, /coursePercent/);
  assert.match(source, /data-bla-five/);
});

test('vocabulary review offers four working modes and writes SRS evidence', () => {
  const source = read('data/beginner-learning-assistant.js');
  for (const mode of ['choice', 'typing', 'listening', 'matching']) assert.match(source, new RegExp(`['"]${mode}['"]`));
  assert.match(source, /VocabularyService\?\.recordRecall/);
  assert.match(source, /ErrorNotebookService\?\.add/);
  assert.match(source, /data-rate="0\.7"/);
  assert.match(source, /reviewStatus === 'wrong'/);
  assert.match(source, /status === 'favorite'/);
});

test('every lesson includes a five-question explained mini test', () => {
  const source = read('app.js');
  assert.match(source, /function lessonMiniTestQuestions/);
  assert.match(source, /Mini test · 5 câu/);
  assert.match(source, /questions\.filter\(\(question\) => answers\[question\.id\] !== question\.correctAnswer\)/);
  assert.match(source, /miniTestScore/);
  assert.match(source, /recommendedReview: miniScore < 60/);
  assert.match(source, /explanation: question\.explanation/);
});

test('assistant assets are part of the offline app shell', () => {
  const worker = read('sw.js');
  assert.match(worker, /beginner-learning-assistant\.css\?v=2/);
  assert.match(worker, /data\/beginner-learning-assistant\.js\?v=3/);
});
