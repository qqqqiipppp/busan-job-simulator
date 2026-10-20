import { MODE_NAMES, buildDistribution, pick, eligibleCompanies, readSavedState } from './lottery.js';
import { renderCompanySummary, renderCompanyDetail, latestCompetition } from './company-view.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const pct = value => `${(value * 100).toLocaleString('ko-KR', { maximumFractionDigits: 3, minimumFractionDigits: 2 })}%`;
const external = (url, label) => `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
const safeURL = url => { try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
const storageKey = 'busan-work-club:v1';
let companies, stats, meta, state, mode = 'weighted', distribution = [], current = null, busy = false, visibleCount = 9;
let toastTimer;
const filters = () => ({ district: $('#district-filter').value, industry: $('#industry-filter').value });
const industry = code => stats.industries.find(s => s.code === code);
const shortSector = code => ({ A:'농림어업',B:'광업',C:'제조업',D:'전기·가스',E:'수도·환경',F:'건설업',G:'도소매업',H:'운수·창고',I:'숙박·음식',J:'정보통신',K:'금융·보험',L:'부동산',M:'전문·과학·기술',N:'사업시설·사업지원',O:'공공행정',P:'교육',Q:'보건·사회복지',R:'문화·여가',S:'기타 서비스' }[code] || '분류 미확인');
const monogram = c => c.name.replace(/\(주\)|주식회사|㈜|\s/g, '').slice(0, 1);

function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show'); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
function saveState() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { toast('기기 저장 공간을 사용할 수 없어 이번 기록은 새로고침 후 사라집니다.'); } }
function getStorage() { try { return localStorage; } catch { return { getItem: () => null }; } }

function updatePool() {
  distribution = buildDistribution(companies, stats, mode, filters());
  document.querySelectorAll('[data-mode]').forEach(button => { const active = button.dataset.mode === mode; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
  $('#pool-count').textContent = `${distribution.length}개 기업`;
  $('#draw-button').disabled = !distribution.length || busy;
  $('#draw-label').textContent = distribution.length ? current ? '다시 취업하기' : '랜덤 취업하기' : '필터를 변경해 주세요';
  const excluded = eligibleCompanies(companies, filters()).length - distribution.length;
  $('#mode-description').textContent = mode === 'weighted' ? `${stats.year}년 부산 업종별 종사자 통계로 보정합니다. 같은 업종 안에서는 균등 추첨합니다.${excluded ? ` 통계 없는 ${excluded}곳 제외.` : ''}` : `선택한 ${distribution.length}개 기업에 동일한 확률을 부여합니다. 지역 고용분포는 반영하지 않습니다.`;
}

function renderCompany(c,event,context) {
  return renderCompanySummary(c,event,context,{modeNames:MODE_NAMES,statsYear:stats.year,sectorLabel:shortSector});
}

function showResult(c, event) {
  current = { ...event, companyId: c.id };
  $('#empty-result').hidden = true;
  $('#company-result').hidden = false;
  $('#company-result').innerHTML = renderCompany(c, event, 'result');
  $('#result-number').textContent = event.context === 'history' ? '최근 기록 다시 보기' : event.context === 'shared' ? '공유된 결과' : `${String(state.total).padStart(2, '0')}번째 가능성`;
  updatePool();
}

async function draw() {
  if (busy || !distribution.length) return;
  busy = true;
  document.body.classList.add('is-drawing');
  // Resolve the draw before animation. Never select names based on visual timing.
  const entry = pick(distribution);
  const event = { companyId: entry.company.id, probability: entry.probability, mode, filters: filters(), poolSize: distribution.length, at: new Date().toISOString(), version: meta.lotteryVersion || meta.version };
  $('#drawing-overlay').hidden = false;
  $('#result-panel').setAttribute('aria-busy', 'true');
  document.querySelectorAll('.mode-switch button, .filter-row select').forEach(el => { el.disabled = true; });
  updatePool();
  if (window.matchMedia('(max-width: 760px)').matches) $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    await new Promise(resolve => setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750));
    state.total = Math.min(state.total + 1, Number.MAX_SAFE_INTEGER);
    state.history.unshift(event); state.history = state.history.slice(0, 20);
    saveState(); showResult(entry.company, event); renderHistory();
    toast(`${entry.company.name}에 취업했습니다. 추첨 확률 ${pct(entry.probability)}`);
  } finally {
    busy = false; document.body.classList.remove('is-drawing'); $('#drawing-overlay').hidden = true; $('#result-panel').setAttribute('aria-busy', 'false');
    document.querySelectorAll('.mode-switch button, .filter-row select').forEach(el => { el.disabled = false; }); updatePool();
  }
}

function renderHistory() {
  $('#total-count').textContent = num(state.total);
  $('#history-count').textContent = String(state.history.length);
  $('#clear-history').disabled = !state.history.length;
  if (!state.history.length) { $('#history').innerHTML = '<div class="history-empty"><span>↗</span><p>아직 출근 기록이 없어요. 첫 번째 회사를 만나보세요.</p><small>최근 20회가 이 기기에 저장됩니다.</small></div>'; return; }
  $('#history').innerHTML = state.history.map((event, index) => { const c = companies.find(c => c.id === event.companyId); return `<button type="button" class="history-item" data-history="${index}"><span class="history-order">↗</span><small>${index === 0 ? '가장 최근에 만난 회사' : `${index + 1}번째 이전 기록`}</small><strong>${esc(c.name)}</strong><span>${esc(c.district)} · ${pct(event.probability)}</span></button>`; }).join('');
}

function renderDirectory() {
  const query = $('#company-search').value.trim().toLocaleLowerCase('ko');
  const matches = companies.filter(c => `${c.name} ${c.legalName || ''} ${c.industryLabel} ${shortSector(c.industryCode)} ${c.district}`.toLocaleLowerCase('ko').includes(query));
  $('#directory-count').textContent = `${matches.length}개 기업`;
  $('#company-grid').innerHTML = matches.slice(0, visibleCount).map(c => `<button type="button" class="company-tile" data-detail="${esc(c.id)}"><div class="tile-top"><span class="company-monogram" aria-hidden="true">${esc(monogram(c))}</span><span>↗</span></div><h3>${esc(c.name)}</h3><p>${esc(c.industryLabel)}</p><div class="tile-footer"><span>⌖ ${esc(c.district)}</span><span>${c.companySize ? esc(c.companySize) : '기업정보 보기'}</span></div></button>`).join('') || '<p class="no-results">검색 결과가 없습니다. 다른 기업명이나 지역을 입력해 주세요.</p>';
  $('#show-more').hidden = visibleCount >= matches.length;
}

function openDetail(id) {
  const c = companies.find(c => c.id === id); if (!c) return;
  $('#detail-title').textContent = c.name; $('#detail-content').innerHTML = renderCompanyDetail(c); $('#detail-dialog').showModal();
}

function renderDataNote() {
  const n = companies.length;
  const coverage = [
    ['평균 연봉·보수',companies.filter(c=>c.averageSalary).length],
    ['신입 초봉',companies.filter(c=>c.startingSalary).length],
    ['평균 근속',companies.filter(c=>c.averageTenure).length],
    ['설립·출범',companies.filter(c=>c.established).length],
    ['공개 채용 경쟁률',companies.filter(c=>latestCompetition(c)).length],
    ['블라인드 기업 링크',companies.filter(c=>c.blind?.companyUrl).length]
  ];
  $('#coverage-cards').innerHTML = coverage.map(([label,count])=>`<div class="coverage-card"><strong>${num(count)}<span class="coverage-denominator"> / ${n}</span></strong><small>${label} 확보</small></div>`).join('');
  const counts = stats.industries.map(s => ({ ...s, count: companies.filter(c => c.industryCode === s.code).length })).filter(s => s.count).sort((a,b) => b.count-a.count);
  $('#industry-chart').innerHTML = counts.map(s => `<div class="chart-row"><span>${esc(shortSector(s.code))}</span><div class="chart-bar"><i style="width:${s.count/counts[0].count*100}%"></i></div><strong>${s.count}</strong></div>`).join('');
  $('#data-date').textContent = `자료 조회 ${meta.accessedAt} · 고용통계 ${stats.year}년 · 데이터 ${meta.version}`;
  $('#global-sources').innerHTML = [ ['https://www.busancompany.com/','부산광역시 선도기업'],[stats.sources[0].url,'부산시 사업체조사'],['https://www.alio.go.kr/','ALIO 경영공시'],['https://www.cleaneye.go.kr/','클린아이'],['https://opendart.fss.or.kr/','OpenDART'],['https://kosis.kr/','KOSIS'] ].map(([url,label]) => external(url,label)).join('');
}

function showMethod(resultContext = false) {
  const target = resultContext && current ? current : { mode, filters: filters() };
  const pool = buildDistribution(companies, stats, target.mode, target.filters);
  const codes = new Set(pool.map(x => x.company.industryCode));
  const represented = stats.industries.filter(s => codes.has(s.code)).reduce((sum,s) => sum+s.employees,0);
  const missing = stats.industries.filter(s => !companies.some(c => c.industryCode === s.code));
  $('#method-content').innerHTML = `<p>${resultContext ? '결과에 적용된 조건' : '현재 선택'}: <strong>${esc(MODE_NAMES[target.mode])}</strong> · ${esc(target.filters.district || '부산 전체')} · ${esc(target.filters.industry ? shortSector(target.filters.industry) : '모든 업종')} · ${pool.length}개 기업</p>
    <h3>현실 기반 취업 → 업종 통계 보정 추첨</h3><p>부산시 ${stats.year}년 기준 사업체조사의 업종별 종사자 수로 업종을 먼저 뽑고, 해당 업종에 수록된 기업을 균등하게 뽑습니다. 기업의 부산 인원이나 전국 인원은 가중치로 사용하지 않습니다.</p>
    <div class="formula">기업 확률 = (해당 업종 부산 종사자 수 ÷ 추첨 대상 업종의 종사자 수 합계) ÷ 해당 업종의 추첨 대상 기업 수</div>
    <p>기업이 없는 업종은 제외하고 재정규화합니다. 구·군/업종 필터 적용 후에도 같은 방식으로 재계산합니다. 구·군별 고용분포를 적용한 것은 아닙니다. 현재 대상 업종의 통계상 종사자는 ${num(represented)}명, 부산 전체 ${num(stats.totalEmployees)}명의 ${pct(represented/stats.totalEmployees)}입니다. 이는 <strong>기업 표본의 고용 포괄률이나 대표성을 의미하지 않습니다.</strong></p>
    <h3>기업 균등 추첨</h3><div class="formula">기업 확률 = 1 ÷ 필터를 통과한 수록 기업 수</div><p>모든 수록 기업을 동일한 확률로 뽑습니다. 통계가 없는 업종도 포함할 수 있으며, 업종 종사자 수는 사용하지 않습니다.</p>
    <h3>규모 통계는 왜 가중치에 쓰지 않나요?</h3><p>${stats.sizes.map(s => `${esc(s.label)} ${num(s.employees)}명`).join(' / ')}입니다. 개별 부산 사업장의 인원 구간을 충분히 확인하지 못해 가중치에 적용하지 않았습니다. 법적 기업 규모와 사업체 인원 구간은 다릅니다. 업종·규모 주변분포를 곱해 교차통계를 만들지 않습니다.</p>
    <h3>현재 데이터의 범위</h3><ul><li>수록 ${companies.length}곳 · 부산 사업장 인원 확인 ${companies.filter(c => c.busanEmployees).length}곳 · 법적 기업 규모 미확인 ${companies.filter(c => !c.companySize).length}곳.</li><li>미수록 업종: ${missing.map(s => esc(s.label)).join(', ')}. 선도기업·공공기관 중심의 표본이며 영세사업체·자영업 대표성이 부족합니다.</li><li>기업 업종은 공개된 주요 제품·서비스에 대응한 탐색용 대분류이며 공식 등록 KSIC 검증값이 아닙니다. 분류 변경은 확률을 바꿀 수 있습니다.</li><li>ALIO 평균보수와 인원·근속은 전국 기관 전체 일반정규직 기준입니다. 상시 종업원수는 월별 급여 지급대상 인원의 연평균이며 현재 부산 재직자 수가 아닙니다.</li><li>블라인드 평점·리뷰·추천율은 수집하지 않았습니다. 재배포 권한이 없어 공식 서비스로 연결합니다. 개별 기업 페이지 미확인 링크는 확보율에 포함하지 않습니다.</li><li>최근 20회와 누적 횟수는 이 브라우저의 저장소에 남습니다. 공유 링크를 열거나 기업을 둘러보는 것은 누적 횟수에 포함되지 않습니다.</li></ul>
    <h3>고용통계 기준 및 출처</h3><p>${esc(stats.attribution)} · 기준일 ${stats.referenceDate} · ${external(stats.sources[0].url,'원문 보고서')}</p><ul>${stats.limitations.map(line => `<li>${esc(line)}</li>`).join('')}</ul>
    <h3>현재 설정의 기업별 정확한 확률</h3><p>표시값은 소수점 셋째 자리까지 반올림합니다. 계산에는 반올림하지 않은 값을 사용합니다. 합계 ${pct(pool.reduce((sum,x) => sum+x.probability,0))}.</p><div class="table-scroll"><table class="method-table"><thead><tr><th>기업</th><th>대응 업종</th><th>당첨 확률</th></tr></thead><tbody>${pool.map(entry => `<tr><td>${esc(entry.company.name)}</td><td>${esc(shortSector(entry.company.industryCode))}</td><td>${pct(entry.probability)}</td></tr>`).join('')}</tbody></table></div>`;
  $('#method-dialog').showModal();
}

function shareURL() {
  const url = new URL(window.location.href); url.hash = ''; url.search = '';
  const params = new URLSearchParams({company:current.companyId,mode:current.mode});
  if (current.filters.district) params.set('district', current.filters.district);
  if (current.filters.industry) params.set('industry', current.filters.industry);
  params.set('v',meta.version); url.hash = params.toString(); return url.href;
}
async function share() {
  if (!current) return;
  const company = companies.find(c => c.id === current.companyId);
  const url = shareURL();
  try {
    if (navigator.share && navigator.canShare?.({ url })) { await navigator.share({ title:'랜덤 부산 취업하기',text:`내 다음 회사는 ${company.name}!`,url }); return; }
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); toast('결과 링크를 복사했습니다.'); return; }
  } catch (err) { if (err.name === 'AbortError') return; }
  $('#detail-title').textContent = '결과 링크 공유';
  $('#detail-content').innerHTML = `<p class="small">아래 링크를 선택해 복사해 주세요. 링크를 열면 해당 기업과 추첨 조건을 확인할 수 있습니다.</p><input id="share-copy-input" class="share-copy-input" aria-label="결과 링크" value="${esc(url)}" readonly>`;
  $('#detail-dialog').showModal(); $('#share-copy-input').select();
}

function compare() {
  const others = state.history.filter(e => e.companyId !== current?.companyId);
  const previous = others[0];
  if (!previous) { toast('다른 회사도 추첨하면 최근 회사와 나란히 비교할 수 있어요.'); return; }
  const selected = [companies.find(c => c.id === current.companyId),companies.find(c => c.id === previous.companyId)];
  const rows = [
    ['지역', c=>c.district],['주요 업종',c=>c.industryLabel],['기업 형태',c=>c.companySize || '정보 없음'],
    ['평균 연봉·보수',c=>c.averageSalary?`${num(c.averageSalary.valueKRW/10000)}만원 (${c.averageSalary.year}년) / ${c.averageSalary.displayScope || c.averageSalary.scope} / ${c.averageSalary.definition}`:'정보 없음'],
    ['신입 초봉',c=>c.startingSalary?`${num(c.startingSalary.valueKRW/10000)}만원 (${c.startingSalary.year}년) / ${c.startingSalary.scope}`:'정보 없음'],
    ['평균 근속',c=>c.averageTenure?`${num(c.averageTenure.valueYears)}년 (${c.averageTenure.year}년) / ${c.averageTenure.displayScope || c.averageTenure.scope}`:'정보 없음'],
    ['부산 사업장 인원',c=>c.busanEmployees?`${num(c.busanEmployees.value)}명 (${c.busanEmployees.year}년) / ${c.busanEmployees.scope}`:'정보 없음'],
    ['최근 공개 채용 경쟁률',c=>{const r=latestCompetition(c);return r?`${num(r.ratio)} : 1 / ${r.year}년 ${r.jobTitle} / ${r.stage}`:'공개된 경쟁률 정보 없음';}]
  ];
  $('#detail-title').textContent = '최근 회사와 비교';
  $('#detail-content').innerHTML = `<p class="small muted">각 회사의 기준연도·전국 집계 범위가 다를 수 있습니다. 보수는 채용 시 제시되는 초봉과 다릅니다.</p><div class="table-scroll"><table class="method-table comparison-table"><thead><tr><th>비교 항목</th>${selected.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn]) => `<tr><th>${esc(label)}</th>${selected.map(c => `<td>${esc(fn(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#detail-dialog').showModal();
}

function restoreShared() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has('company')) return;
  const c = companies.find(c => c.id === params.get('company'));
  if (!c) { toast('현재 데이터에 없는 기업의 공유 링크입니다.'); return; }
  const sharedMode = ['weighted','uniform'].includes(params.get('mode')) ? params.get('mode') : 'uniform';
  const sharedFilters = {district:params.get('district') || '',industry:params.get('industry') || ''};
  const sharedPool = buildDistribution(companies, stats, sharedMode, sharedFilters);
  const entry = sharedPool.find(entry => entry.company.id === c.id);
  if (!entry) { openDetail(c.id); toast('공유 조건에 이 기업이 없어 기업정보만 표시합니다.'); return; }
  mode = sharedMode; $('#district-filter').value = sharedFilters.district; $('#industry-filter').value = sharedFilters.industry;
  showResult(c,{companyId:c.id,mode:sharedMode,filters:sharedFilters,probability:entry.probability,poolSize:sharedPool.length,context:'shared'});
  if (params.get('v') !== meta.version) toast('데이터 버전이 달라 현재 데이터로 확률을 다시 계산했습니다.');
}

async function init() {
  try {
    const getJSON = async path => { const r = await fetch(path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };
    const [database, statistics] = await Promise.all([getJSON('./data/companies.json'),getJSON('./data/employment.json')]);
    companies = database.companies; meta = database.meta; stats = statistics;
    state = readSavedState(getStorage(),storageKey,companies,meta.lotteryVersion || meta.version);
    $('#verified-count').textContent = String(companies.length); $('#sector-count').textContent = String(new Set(companies.map(c => c.industryCode)).size);
    [...new Set(companies.map(c => c.district))].sort((a,b) => a.localeCompare(b,'ko')).forEach(district => $('#district-filter').add(new Option(district,district)));
    stats.industries.filter(s => companies.some(c => c.industryCode === s.code)).forEach(s => $('#industry-filter').add(new Option(shortSector(s.code),s.code)));
    updatePool(); renderHistory(); renderDirectory(); renderDataNote(); restoreShared();
    $('#draw-button').addEventListener('click',draw);
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click',() => { mode = button.dataset.mode; updatePool(); }));
    document.querySelectorAll('.filter-row select').forEach(select => select.addEventListener('change',updatePool));
    $('#company-search').addEventListener('input',() => { visibleCount = 9; renderDirectory(); });
    $('#show-more').addEventListener('click',() => { visibleCount += 12; renderDirectory(); });
    $('#clear-history').addEventListener('click',() => { state.history = []; saveState(); renderHistory(); toast('최근 기록을 비웠습니다. 누적 취업 횟수는 유지됩니다.'); });
    window.addEventListener('hashchange',restoreShared);
    document.addEventListener('click',event => {
      const methodTrigger = event.target.closest('.methodology-trigger');
      if (methodTrigger) showMethod(Boolean(methodTrigger.closest('.probability-strip')));
      const expand = event.target.closest('[data-expand]');
      if (expand) {
        const content = document.getElementById(expand.getAttribute('aria-controls'));
        const open = expand.getAttribute('aria-expanded') !== 'true';
        expand.setAttribute('aria-expanded',String(open)); content.hidden = !open;
        expand.innerHTML = open ? '기업 상세정보 닫기 <span>−</span>' : '기업 상세정보 보기 <span>＋</span>';
      }
      const detail = event.target.closest('[data-detail]'); if (detail) openDetail(detail.dataset.detail);
      const history = event.target.closest('[data-history]'); if (history) { const saved = state.history[Number(history.dataset.history)]; const c = companies.find(c => c.id === saved.companyId); showResult(c,{...saved,context:'history'}); $('#result-panel').scrollIntoView({behavior:'smooth',block:'start'}); }
      const action = event.target.closest('[data-action]'); if (action?.dataset.action === 'share') share(); if (action?.dataset.action === 'compare') compare();
    });
  } catch (error) {
    console.error(error); $('#draw-label').textContent = '데이터를 불러오지 못했어요'; $('#mode-description').textContent = '네트워크 상태를 확인한 뒤 새로고침해 주세요. 내려받은 파일은 README의 로컬 실행 방법으로 열어주세요.'; toast('기업 자료를 불러오지 못했습니다. 새로고침해 주세요.');
  }
}
document.querySelectorAll('dialog').forEach(dialog => { dialog.querySelector('.close-dialog').addEventListener('click',() => dialog.close()); dialog.addEventListener('click',event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }); });
init();
