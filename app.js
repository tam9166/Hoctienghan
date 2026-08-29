const state = {
  route: 'home', lessonProgress: 2, dailyGoal: 3, streak: 15,
  selectedWords: [], recording: false, mediaRecorder: null, chunks: []
};

const lessons = [
  {id:'hangul', title:'Bảng chữ cái Hangul', sub:'Nền tảng', icon:'한', status:'done'},
  {id:'consonants', title:'Phụ âm', sub:'14 phụ âm cơ bản', icon:'ㄱ', status:'done'},
  {id:'vowels', title:'Nguyên âm', sub:'10 nguyên âm cơ bản', icon:'ㅏ', status:'active'},
  {id:'topic-particle', title:'Trợ từ chủ đề 은/는', sub:'Ngữ pháp sơ cấp', icon:'은', status:'active'},
  {id:'greetings', title:'Chào hỏi', sub:'TOPIK I', icon:'안', status:'locked'},
  {id:'numbers', title:'Số đếm', sub:'TOPIK I', icon:'1', status:'locked'}
];

function setRoute(route){ state.route=route; window.location.hash=route; render(); }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800); }
function nav(){ document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===state.route)); }
function app(){return document.getElementById('app')}

function homeView(){
  const pct=Math.round(state.lessonProgress/state.dailyGoal*100);
  return `
  <section class="card glass section">
    <div class="progress-row">
      <div class="progress-copy"><h2 class="section-title">Mục tiêu ngày</h2><p class="subtle">Hoàn thành 3 bài học để giữ chuỗi!</p><div class="bar"><span style="width:${pct}%"></span></div><p class="subtle" style="text-align:right;margin-bottom:0">${state.lessonProgress}/${state.dailyGoal} bài học</p></div>
      <div class="ring" style="background:conic-gradient(var(--tertiary) 0 ${pct}%,var(--surface-mid) ${pct}% 100%)"><b>${pct}%</b></div>
    </div>
  </section>
  <section class="roadmap section">
    <div class="level-label">Người mới bắt đầu (Hangul)</div>
    <div class="node completed"><button class="node-btn" data-open-lesson="hangul">✓</button><div class="node-label">Bảng chữ cái</div></div>
    <div class="node completed"><button class="node-btn" data-open-lesson="consonants">★</button><div class="node-label">Phụ âm</div></div>
    <div class="node active"><button class="node-btn" data-open-lesson="topic-particle">▶</button><div class="node-label">Nguyên âm / Ngữ pháp</div></div>
    <div class="level-label">Sơ cấp (TOPIK I)</div>
    <div class="node locked"><button class="node-btn">🔒</button><div class="node-label">Chào hỏi</div></div>
    <div class="node locked"><button class="node-btn">🔒</button><div class="node-label">Số đếm</div></div>
  </section>`;
}

function lessonsView(){
  return `<section class="section"><h1 class="headline">Bài học</h1><p class="subtle">Học theo lộ trình từ Hangul đến TOPIK.</p></section>
  <section class="lesson-list">${lessons.map(l=>`<button class="lesson-item ${l.status==='locked'?'locked':''}" ${l.status!=='locked'?`data-open-lesson="${l.id}"`:''}><span class="lesson-icon">${l.icon}</span><span><strong>${l.title}</strong><small>${l.sub}</small></span><span style="margin-left:auto">${l.status==='done'?'✓':l.status==='locked'?'🔒':'›'}</span></button>`).join('')}</section>`;
}

function lessonView(){
  return `
  <div class="lesson-header"><button class="close-btn" data-route-btn="lessons">×</button><div class="lesson-progress"><div class="bar"><span style="width:30%"></span></div></div><span class="subtle">3/10</span></div>
  <section class="section" style="text-align:center"><h1 class="headline">Trợ từ chủ đề</h1><div class="korean">은/는</div></section>
  <section class="card glass section"><h2 class="section-title">🧠 So sánh với Tiếng Việt</h2><p class="subtle">Trong tiếng Hàn, <b>은/는</b> được gắn sau danh từ để đánh dấu chủ đề của câu. Có thể hiểu gần với “thì” hoặc “là” trong tiếng Việt.</p><div class="grammar-box"><b>Quy tắc</b><ul class="subtle"><li>Có patchim (phụ âm cuối) + <b>은</b></li><li>Không có patchim + <b>는</b></li></ul></div></section>
  <section class="section"><h2 class="section-title">Ví dụ</h2>
    <div class="example"><div><div class="korean" style="font-size:20px">저<span class="highlight">는</span> 학생입니다.</div><div class="subtle">Tôi là học sinh.</div></div><button class="audio-btn" data-speak="저는 학생입니다">🔊</button></div>
    <div class="example"><div><div class="korean" style="font-size:20px">선생님<span class="highlight">은</span> 한국 사람입니다.</div><div class="subtle">Giáo viên là người Hàn Quốc.</div></div><button class="audio-btn" data-speak="선생님은 한국 사람입니다">🔊</button></div>
  </section>
  <section class="exercise section"><h2 class="section-title">🧩 Sắp xếp câu</h2><p class="subtle" style="text-align:center">Tạo câu: “Tôi là người Việt Nam.”</p><div id="dropZone" class="drop-zone"></div><div id="chipBox" class="chips"></div><div class="action-row"><button class="btn secondary" id="resetSentence">Làm lại</button><button class="btn primary" id="checkSentence">Kiểm tra</button></div></section>
  <div class="action-row"><button class="btn secondary" data-route-btn="lessons">Quay lại</button><button class="btn primary" data-route-btn="practice">Tiếp theo</button></div>`;
}

function practiceView(){
  return `<section class="card practice-card section"><span class="subtle" style="text-transform:uppercase">Luyện đọc câu sau</span><div class="phrase">안녕하세요</div><button class="audio-btn" data-speak="안녕하세요">🔊</button><div><span class="translation">Xin chào</span></div></section>
  <section class="card section"><div class="subtle" style="text-align:center">Kết quả ghi âm</div><div class="result-word" style="text-align:center;margin-top:10px"><span class="ok">안녕</span><span class="bad">하세요</span></div></section>
  <section class="card glass section"><div class="feedback"><div class="ai-dot">✦</div><div><b style="color:var(--primary)">Tailored Feedback</b><p class="subtle" style="margin-bottom:0">Lưu ý: âm <b style="color:var(--danger)">'ha'</b> cần bật hơi rõ hơn. Khi luyện, hãy mở khẩu hình thêm một chút.</p></div></div></section>
  <div class="mic-wrap"><button id="micBtn" class="mic-btn">🎙</button><div class="subtle" id="micLabel">Nhấn để bắt đầu ghi âm</div></div>
  <div class="action-row"><button class="btn secondary" data-route-btn="home">Bỏ qua</button><button class="btn primary" id="practiceNext">Tiếp theo</button></div>`;
}

function profileView(){
  return `<section class="card profile-head section"><div class="profile-avatar">한</div><h1 class="headline" style="font-size:23px">Nguyễn Văn A</h1><p class="subtle">Học viên xuất sắc · TOPIK 3</p><div class="stats"><div class="stat"><b>120</b><small>Bài học</small></div><div class="stat"><b>85%</b><small>Hoàn thành</small></div><div class="stat"><b>45</b><small>Ngày học</small></div></div></section>
  <section class="card section"><h2 class="section-title">📊 Tiến độ kỹ năng</h2><div class="skill-grid"><div class="skill"><strong>75%</strong><div class="subtle">Nghe</div></div><div class="skill"><strong>50%</strong><div class="subtle">Nói</div></div><div class="skill"><strong>90%</strong><div class="subtle">Đọc</div></div><div class="skill"><strong>40%</strong><div class="subtle">Viết</div></div></div></section>
  <section class="card section"><h2 class="section-title">🏅 Huy hiệu</h2><div class="badges"><div class="badge"><div class="badge-icon">🔥</div><small>Chăm chỉ</small></div><div class="badge"><div class="badge-icon">🎙</div><small>Phát âm chuẩn</small></div><div class="badge"><div class="badge-icon">🧠</div><small>Trí nhớ tốt</small></div><div class="badge" style="opacity:.45"><div class="badge-icon">🔒</div><small>Cao thủ TOPIK</small></div></div></section>
  <section class="card section"><h2 class="section-title">🕘 Lịch sử thi thử</h2><div class="history-item"><div><b>TOPIK I - Đề 1</b><div class="subtle">Hôm qua, 14:30</div></div><div class="score">160/200</div></div><div class="history-item"><div><b>Đề luyện tập Nghe</b><div class="subtle">3 ngày trước</div></div><div class="score">75/100</div></div></section>`;
}

function render(){
  nav();
  const views={home:homeView,lessons:lessonsView,lesson:lessonView,practice:practiceView,profile:profileView};
  app().innerHTML=(views[state.route]||homeView)();
  bindEvents();
}

function bindEvents(){
  document.querySelectorAll('[data-route-btn]').forEach(b=>b.onclick=()=>setRoute(b.dataset.routeBtn));
  document.querySelectorAll('[data-open-lesson]').forEach(b=>b.onclick=()=>setRoute('lesson'));
  document.querySelectorAll('[data-speak]').forEach(b=>b.onclick=()=>speakKorean(b.dataset.speak));
  if(state.route==='lesson') setupSentence();
  if(state.route==='practice') setupMic();
  const next=document.getElementById('practiceNext'); if(next) next.onclick=()=>{state.lessonProgress=Math.min(state.dailyGoal,state.lessonProgress+1); toast('Đã cộng tiến độ hôm nay'); setRoute('home')};
}

function setupSentence(){
  state.selectedWords=[];
  const all=['베트남 사람입니다','저','는'];
  const zone=document.getElementById('dropZone'), box=document.getElementById('chipBox');
  function draw(){
    zone.innerHTML=state.selectedWords.map((w,i)=>`<button class="chip selected" data-selected="${i}">${w}</button>`).join('') || '<span class="subtle">Chạm vào các từ bên dưới</span>';
    box.innerHTML=all.filter(w=>!state.selectedWords.includes(w)).map(w=>`<button class="chip" data-word="${w}">${w}</button>`).join('');
    box.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>{state.selectedWords.push(b.dataset.word);draw()});
    zone.querySelectorAll('[data-selected]').forEach(b=>b.onclick=()=>{state.selectedWords.splice(Number(b.dataset.selected),1);draw()});
  }
  draw();
  document.getElementById('resetSentence').onclick=()=>{state.selectedWords=[];draw()};
  document.getElementById('checkSentence').onclick=()=>{
    const ok=state.selectedWords.join(' ')==='저 는 베트남 사람입니다';
    toast(ok?'Chính xác! 잘했어요 🎉':'Chưa đúng. Gợi ý: 저 + 는 + 베트남 사람입니다');
  };
}

function speakKorean(text){
  if(!('speechSynthesis' in window)){toast('Thiết bị chưa hỗ trợ đọc văn bản');return;}
  speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='ko-KR'; u.rate=.85; speechSynthesis.speak(u);
}

function setupMic(){
  const btn=document.getElementById('micBtn'), label=document.getElementById('micLabel');
  btn.onclick=async()=>{
    if(state.recording){ state.mediaRecorder?.stop(); return; }
    if(!navigator.mediaDevices?.getUserMedia){toast('Trình duyệt không hỗ trợ ghi âm');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const rec=new MediaRecorder(stream); state.mediaRecorder=rec; state.chunks=[];
      rec.ondataavailable=e=>state.chunks.push(e.data);
      rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());state.recording=false;btn.classList.remove('recording');btn.textContent='🎙';label.textContent='Đã ghi âm. Nhấn để thử lại';toast('Đã ghi âm thành công');};
      rec.start(); state.recording=true; btn.classList.add('recording');btn.textContent='■';label.textContent='Đang ghi âm... nhấn để dừng';
    }catch(e){toast('Cần cấp quyền micro để luyện phát âm');}
  };
}

document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>setRoute(b.dataset.route));
document.getElementById('avatarBtn').onclick=()=>setRoute('profile');
window.addEventListener('hashchange',()=>{const r=location.hash.replace('#','');if(r&&r!==state.route){state.route=r;render()}});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
const initial=location.hash.replace('#',''); if(initial) state.route=initial; render();
