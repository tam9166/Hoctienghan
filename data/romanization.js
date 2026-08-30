(function buildRomanizationSupport(global) {
  'use strict';

  const curated = Object.freeze({
    '안녕하세요': 'annyeonghaseyo',
    '감사합니다': 'gamsahamnida',
    '죄송합니다': 'joesonghamnida',
    '괜찮아요': 'gwaenchanayo',
    '반갑습니다': 'bangapseumnida',
    '안녕히 가세요': 'annyeonghi gaseyo',
    '안녕히 계세요': 'annyeonghi gyeseyo',
    '처음 뵙겠습니다': 'cheoeum boepgetseumnida',
    '잘 지내세요?': 'jal jinaeseyo?',
    '어서 오세요': 'eoseo oseyo',
    '학교': 'hakgyo',
    '한국': 'hanguk',
    '한국어': 'hangugeo',
    '학생': 'haksaeng',
    '선생님': 'seonsaengnim',
    '저는 학생입니다.': 'jeoneun haksaeng-imnida.',
    '선생님은 한국 사람입니다.': 'seonsaengnimeun hanguk saram-imnida.',
    '한국어를 꾸준히 연습해요.': 'hangugeoreul kkujunhi yeonseuphaeyo.',
    '오늘 날씨가 정말 좋네요.': 'oneul nalssiga jeongmal johneyo.',
    '천천히 따라 말해 보세요.': 'cheoncheonhi ttara malhae boseyo.',
    '저는 아침마다 지하철을 타고 회사에 갑니다.': 'jeoneun achimmada jihacheoreul tago hoesae gamnida.',
    '안녕하세요. 무엇을 도와드릴까요?': 'annyeonghaseyo. mueoseul dowadeurilkkayo?',
    '주말에 보통 무엇을 합니까?': 'jumare botong mueoseul hamnikka?',
    '어서 오세요. 몇 분이세요?': 'eoseo oseyo. myeot bun-iseyo?',
    '지금 몇 시예요?': 'jigeum myeot siyeyo?',
    '한국에서 이루고 싶은 목표를 말해 보세요.': 'hangugeseo irugo sipeun mokpyoreul malhae boseyo.',
    '환경을 보호하기 위해 할 수 있는 일을 설명해 보세요.': 'hwangyeongeul bohohagi wihae hal su inneun ireul seolmyeonghae boseyo.',
    '어떤 것을 찾으세요?': 'eotteon geoseul chajeuseyo?',
    '지원 동기를 말씀해 주세요.': 'jiwon donggireul malsseumhae juseyo.',
    '자료를 오늘까지 보낼 수 있어요?': 'jaryoreul oneulkkaji bonael su isseoyo?',
    '어디가 불편하세요?': 'eodiga bulpyeonhaseyo?',
    '어떤 수업을 신청하고 싶어요?': 'eotteon sueobeul sincheonghago sipeoyo?',
    '왜 한국에서 공부하고 싶어요?': 'wae hangugeseo gongbuhago sipeoyo?',
    '관련 경력이 있으세요?': 'gwallyeon gyeongnyeogi isseuseyo?',
    '기계에 어떤 문제가 있어요?': 'gigyee eotteon munjega isseoyo?',
    '어디까지 가세요?': 'eodikkaji gaseyo?',
    '무슨 업무를 보러 오셨어요?': 'museun eommureul boreo osyeosseoyo?',
    '어떤 방을 찾으세요?': 'eotteon bangeul chajeuseyo?',
    '두 명이에요.': 'du myeong-ieyo.',
    '이 옷을 찾고 있어요.': 'i oseul chatgo isseoyo.',
    '관련 경험을 쌓고 싶어서 지원했습니다.': 'gwallyeon gyeongheomeul ssako sipeoseo jiwonhaetseumnida.',
    '네, 오늘까지 보내겠습니다.': 'ne, oneulkkaji bonaegesseumnida.',
    '어제부터 배가 아파요.': 'eojebuteo baega apayo.',
    '한국어 수업을 신청하고 싶어요.': 'hangugeo sueobeul sincheonghago sipeoyo.',
    '한국에서 제 전공을 더 배우고 싶어요.': 'hangugeseo je jeongongeul deo baeugo sipeoyo.',
    '네, 이 분야에서 이 년 동안 일했습니다.': 'ne, i bunyaeseo i nyeon dongan ilhaetseumnida.',
    '기계가 갑자기 멈췄어요.': 'gigyega gapjagi meomchwosseoyo.',
    '서울역까지 가요.': 'seoullyeokkkaji gayo.',
    '계좌로 송금하러 왔어요.': 'gyejwareo songgeumhareo wasseoyo.',
    '보증금이 적은 방을 찾고 있어요.': 'bojeunggeumi jeogeun bangeul chatgo isseoyo.'
  });

  const pronunciation = Object.freeze({
    '오늘 날씨가 정말 좋네요.': 'oneul nalssiga jeongmal jonneyo.',
    '관련 경력이 있으세요?': 'gwallyeon gyeongnyeogi isseuseyo?',
    '서울역까지 가요.': 'seoullyeokkkaji gayo.'
  });

  const initials = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  const vowels = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  const finals = ['', 'k','k','k','n','n','n','t','l','k','m','p','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
  const liaisonOnsets = { 1:'g',2:'kk',3:'gs',4:'n',5:'nj',6:'nh',7:'d',8:'r',9:'lg',10:'lm',11:'lb',12:'ls',13:'lt',14:'lp',15:'lh',16:'m',17:'b',18:'bs',19:'s',20:'ss',21:'ng',22:'j',23:'ch',24:'k',25:'t',26:'p',27:'h' };
  const hangulSyllable = /[가-힣]/;

  function decompose(character) {
    const offset = character.charCodeAt(0) - 0xAC00;
    return { initial: Math.floor(offset / 588), vowel: Math.floor((offset % 588) / 28), final: offset % 28 };
  }

  function romanizeHangulRun(run) {
    const syllables = [...run].map(decompose);
    const incoming = {};
    return syllables.map((syllable, index) => {
      const next = syllables[index + 1];
      let onset = incoming[index] ?? initials[syllable.initial];
      let ending = finals[syllable.final];
      if (next && next.initial === 11 && syllable.final) {
        const movable = liaisonOnsets[syllable.final];
        if (movable) {
          if ([3,5,6,9,10,11,12,13,14,15,18].includes(syllable.final)) {
            ending = finals[syllable.final];
          } else {
            ending = '';
          }
          incoming[index + 1] = movable.length > 1 && ![2,20].includes(syllable.final) ? movable.slice(-1) : movable;
        }
      } else if (next && [2,6].includes(next.initial)) {
        if ([1,2,3,9,24].includes(syllable.final)) ending = 'ng';
        if ([7,19,20,22,23,25,27].includes(syllable.final)) ending = 'n';
        if ([17,18,26].includes(syllable.final)) ending = 'm';
        if (syllable.final === 4 && next.initial === 5) { ending = 'l'; incoming[index + 1] = 'l'; }
        if (syllable.final === 8 && next.initial === 2) { ending = 'l'; incoming[index + 1] = 'l'; }
      }
      return `${onset}${vowels[syllable.vowel]}${ending}`;
    }).join('');
  }

  function fallback(text = '') {
    let result = '';
    let run = '';
    const flush = () => { if (run) { result += romanizeHangulRun(run); run = ''; } };
    for (const character of String(text).normalize('NFC')) {
      if (hangulSyllable.test(character)) run += character;
      else { flush(); result += character; }
    }
    flush();
    return result.toLowerCase();
  }

  function romanize(text = '') {
    const normalized = String(text).trim().normalize('NFC');
    return curated[normalized] || fallback(normalized);
  }

  global.KLEARN_ROMANIZATION = Object.freeze({
    curated,
    pronunciation,
    romanize,
    getPronunciation(text = '') { return pronunciation[String(text).trim().normalize('NFC')] || ''; },
    isCurated(text = '') { return Object.prototype.hasOwnProperty.call(curated, String(text).trim().normalize('NFC')); }
  });
})(window);
