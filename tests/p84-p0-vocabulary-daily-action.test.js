#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function boot() {
  const values = new Map(); const state = { currentUser:{ id:'p84-user', fullName:'P84 User', goals:['topik'], targetTopikLevel:2 }, currentView:'home', srsData:[], p82Vocabulary:null, p84Vocabulary:null };
  const scoped = (key) => structuredClone(values.get(`${key}:${state.currentUser.id}`) || []);
  const saveScoped = (key, value) => { values.set(`${key}:${state.currentUser.id}`, structuredClone(value)); return value; };
  const document = { documentElement:{ lang:'vi' }, querySelector:()=>null, querySelectorAll:()=>[], getElementById:()=>null, createElement:()=>({ click(){} }) };
  const SRSStateService = {
    hasLearningEvidence(card={}) { return Boolean(card.activatedAt || card.lastReviewed || Number(card.reviewCount) || Number(card.mastery) || ['learning','review','mastered'].includes(card.status)); },
    isDue(card={}, at=Date.now()) { return this.hasLearningEvidence(card) && card.nextReview && new Date(card.nextReview).getTime() <= at; }
  };
  const MasteryService = { status:(score) => Number(score)>=80?'mastered':Number(score)>=50?'understood':Number(score)>0?'learning':'not_started' };
  const saveSrs = (cards) => { state.srsData=structuredClone(cards); return state.srsData; };
  const VocabularyService = { recordRecall(card, correct, response, metadata={}) { const current=state.srsData.find((item)=>item.wordId===card.wordId); const at=new Date().toISOString(); const mastery=Math.max(0,Math.min(100,Number(current.mastery||0)+(correct?10:-18))); Object.assign(current,{reviewCount:Number(current.reviewCount||0)+1,correctCount:Number(current.correctCount||0)+(correct?1:0),wrongCount:Number(current.wrongCount||0)+(correct?0:1),mastery,status:correct?'review':'learning',lastReviewed:at,nextReview:new Date(Date.now()+(correct?86400000:600000)).toISOString(),personalVocabularyEvidence:metadata.personalVocabularyEvidence}); return structuredClone(current); } };
  const errors=[];
  const window = { document, KLEARN_EXTRA_VIEWS:{}, KLEARN_AFTER_RENDER:null, ErrorNotebookService:{ all:()=>errors, add:(item)=>{ errors.push({ ...structuredClone(item), id:`e-${errors.length}`, count:1, resolved:false }); return item; } }, AdaptiveDifficultyService:{ record(){} }, caches:{ async open(){ return { add:async()=>true }; } }, URL:{ createObjectURL:()=>'', revokeObjectURL(){} }, confirm:()=>true, prompt:()=>null,
    KLEARN_APP:{ state, STORAGE_KEYS:{ vocabularyCollections:'collections', offlinePacks:'offline', dailyExperience:'dailyExperience' }, escapeHtml:String, render(){}, setView(view){state.currentView=view;}, toast(){}, userScoped:scoped, saveUserScoped:saveScoped, getUserSrs:()=>state.srsData, saveUserSrs:saveSrs, VocabularyService, SRSStateService, MasteryService, CloudSyncService:{schedule(){}}, PrivacyPreferenceService:{allows:()=>false}, emitLearningMutation(){}, speakKorean(){} }
  };
  window.window=window;
  const context={window,document,console,Date,Intl,Math,JSON,Object,Array,Number,String,Boolean,RegExp,Set,Map,Promise,Symbol,structuredClone,setTimeout,clearTimeout,Blob,FormData:class{},URL:window.URL};
  vm.runInNewContext(read('data/personal-vocabulary-system.js'),context); vm.runInNewContext(read('data/vocabulary-daily-action.js'),context);
  return { window, state, values, errors };
}
function seed(rt, count=100) {
  const rows=['Korean,Meaning,Topic']; for(let i=0;i<count;i+=1) rows.push(`단어${i},Nghĩa ${i},TOPIK II`);
  const output=rt.window.P82ImportService.createDeckFromFile({title:'TOPIK II Vocabulary',fileName:'p84.csv',text:rows.join('\n')}); rt.state.p82Vocabulary.deckId=output.deck.id; return output.deck.id;
}
function cardsFor(rt, deckId, setup) {
  const words=rt.window.P82DeckService.words(deckId); const now=Date.now(); rt.state.srsData=words.map((word,index)=>setup(word,index,now)).filter(Boolean); return words;
}
function card(word, changes={}) { return { id:word.id,wordId:word.id,deckId:word.deckId,korean:word.korean,meaningVi:word.meaning,status:'not_started',mastery:0,reviewCount:0,correctCount:0,wrongCount:0,nextReview:null,...changes }; }

(() => {
  const rt=boot(); const w=rt.window; const deckId=seed(rt);
  const words=cardsFor(rt,deckId,(word,index,now)=> index<5?card(word,{status:'review',mastery:65,reviewCount:4,correctCount:3,wrongCount:1,nextReview:new Date(now-86400000).toISOString(),activatedAt:new Date(now-5*86400000).toISOString()}):index<15?card(word,{status:'learning',mastery:20,reviewCount:5,correctCount:1,wrongCount:4,nextReview:new Date(now+86400000).toISOString(),activatedAt:new Date(now-4*86400000).toISOString()}):index<20?card(word,{status:'learning',mastery:45,reviewCount:2,correctCount:2,nextReview:new Date(now+86400000).toISOString(),activatedAt:new Date(now-2*86400000).toISOString()}):index<40?card(word,{status:'mastered',mastery:90,reviewCount:8,correctCount:8,nextReview:new Date(now+5*86400000).toISOString(),activatedAt:new Date(now-20*86400000).toISOString()}):null);
  const snapshot=w.P84TodayVocabularyService.snapshot(); assert.equal(snapshot.due.length,5); assert.equal(snapshot.weak.length,10); assert.equal(w.P84TodayVocabularyService.recommendation().reason,'due');
  const started=w.P84TodayVocabularyService.startRequested(10); assert.equal(started.count,10); assert.equal(new Set(started.session.selectedWordIds).size,10); assert.deepEqual(Array.from(started.session.selectedWordIds.slice(0,5)),Array.from(words.slice(0,5).map((word)=>word.id)),'due SRS must be first');
  const deck=w.P82DeckService.get(deckId); deck.activeSession=null; w.P82DeckService.save(deck,'test-reset'); rt.state.currentView='home';
  assert.equal(w.P84TodayVocabularyService.validateCount('text',20,true).ok,false); assert.equal(w.P84TodayVocabularyService.validateCount(0,20,true).ok,false); assert.equal(w.P84TodayVocabularyService.validateCount(-2,20,true).ok,false); assert.equal(w.P84TodayVocabularyService.validateCount(21,20,true).ok,false); assert.equal(w.P84TodayVocabularyService.validateCount(20,7,false).count,7); assert.equal(w.P84TodayVocabularyService.validateCount(20,7,false).adjusted,true);
  assert.equal(w.P84TodayVocabularyService.frequentlyWrong({progress:{wrongAttempts:1,correctAttempts:0,weak:true}},1),false); assert.equal(w.P84TodayVocabularyService.frequentlyWrong({progress:{wrongAttempts:3,correctAttempts:1,weak:true}},0),true);

  const noDue=boot(); const noDueDeck=seed(noDue,20); assert.equal(noDue.window.P84TodayVocabularyService.recommendation().reason,'unmastered'); assert.equal(noDue.window.P84TodayVocabularyService.pool('unmastered').length,20);
  for(const count of [5,10,20,15]) { const run=boot(); const id=seed(run,25); run.state.p82Vocabulary.deckId=id; const result=run.window.P84TodayVocabularyService.startRequested(count,count===15); assert.equal(result.count,count); }

  const allMastered=boot(); const masteredDeck=seed(allMastered,12); cardsFor(allMastered,masteredDeck,(word,index,now)=>card(word,{status:'mastered',mastery:92,reviewCount:8,correctCount:8,nextReview:new Date(now+86400000).toISOString(),activatedAt:new Date(now-30*86400000).toISOString()})); assert.equal(allMastered.window.P84TodayVocabularyService.recommendation().kind,'complete'); assert.equal(allMastered.window.P84TodayVocabularyService.pool('unmastered').length,0);
  allMastered.state.srsData[0].nextReview=new Date(Date.now()-1000).toISOString(); const dueMastered=allMastered.window.P84TodayVocabularyService.snapshot(); assert.equal(dueMastered.due.length,1,'mastered words must return when SRS is due'); assert.equal(dueMastered.unmastered.length,0,'mastered due must not become unmastered');

  const retry=boot(); const retryDeck=seed(retry,5); const session=retry.window.P84TodayVocabularyService.startRequested(5); const first=retry.window.P82LearningSessionService.currentWord(retryDeck); retry.window.P82LearningSessionService.answer(retryDeck,'sai'); let guard=0; while(retry.window.P82LearningSessionService.current(retryDeck)&&guard<20){const current=retry.window.P82LearningSessionService.currentWord(retryDeck);retry.window.P82LearningSessionService.answer(retryDeck,current.korean);guard+=1;} const history=retry.window.P82DeckService.get(retryDeck).sessionHistory[0]; assert.equal(history.source,'p84-today'); assert.deepEqual(Array.from(history.weakWordIds),[first.id]); assert.equal(retry.errors.length,1); assert.equal(retry.state.srsData.find((item)=>item.wordId===first.id).wrongCount,1); assert.equal(retry.window.P82DeckService.get(retryDeck).activeSession,null); retry.window.P84TodayVocabularyService.retryLatest(retryDeck); assert.deepEqual(Array.from(retry.window.P82LearningSessionService.current(retryDeck).selectedWordIds),[first.id]); assert.ok(session);

  const combined=[read('data/vocabulary-daily-action.js'),read('vocabulary-daily-action.css'),read('data/route-loader.js'),read('sw.js'),read('app.js')].join('\n');
  assert.match(combined,/p84VocabularyDaily/); assert.match(combined,/preferredVocabularyCount/); assert.match(combined,/data-p84-size/); assert.match(combined,/@media \(max-width:430px\)/); assert.match(combined,/prefers-reduced-motion/); assert.doesNotMatch(read('data/vocabulary-daily-action.js'),/fetch\(|AICoach|AIOrchestration/); assert.match(read('scripts/vercel-function-audit.js'),/api/);
  console.log('P84-P0 unit: due priority, unmastered, frequent wrong, 5/10/20/custom, capacity adjustment, exact no-duplicate selection, mastered-due SRS, retry, persistence, offline assets, privacy and reuse of P82 passed');
})();
