const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formatNumber = n => Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
const formatMoney = n => `${formatNumber(n/10000)}만원`;
const formatProbability = n => `${(n*100).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:3})}%`;
function sourceLink(url,label='원문 확인') {
  try { const u=new URL(url); if(u.protocol!=='https:' && u.protocol!=='http:')return ''; return `<a href="${escapeHTML(u.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} ↗</a>`; }catch{return '';}
}
export function latestCompetition(company) {
  return [...(company.recruitmentCompetition || [])].filter(r=>r.verification==='verified' && Number.isFinite(r.ratio) && r.ratio>0).sort(compareCompetitionDates)[0] || null;
}
function compareCompetitionDates(a,b) {
  const key=r=>String(r.publishedAt || r.referenceDate || r.period || '').replace('하반기','07').replace('상반기','01');
  return b.year-a.year || key(b).localeCompare(key(a));
}
function measurementNote(value) {
  if(!value)return '확인된 공개 자료 없음';
  return `${value.year ? `${value.year}년` : value.asOf || '기준연도 미표기'} · ${value.displayScope || value.scope || '범위 미표기'}`;
}
function metric(label,value,unit,note) { return `<div><small>${escapeHTML(label)}</small><strong class="${value===null?'unavailable':''}">${value===null?'정보 없음':escapeHTML(value)}${unit?`<span class="metric-unit">${escapeHTML(unit)}</span>`:''}</strong><em>${escapeHTML(note)}</em></div>`; }
function field(label,value,note='') { return `<div class="fact"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value ?? '정보 없음')}</strong>${note?`<small class="fact-note">${escapeHTML(note)}</small>`:''}</div>`; }
function metricDetail(label,value,text) {
  return `<div class="detail-fact"><h4>${escapeHTML(label)}</h4><strong>${value ? escapeHTML(text) : '정보 없음'}</strong>${value?`<p>${escapeHTML(measurementNote(value))}<br>${escapeHTML(value.definition || '')}</p>${sourceLink(value.sourceUrl)}`:''}</div>`;
}
export function renderCompetition(record,compact=false) {
  if(!record)return '<div class="competition-summary competition-empty"><h3>🎯 공개 채용 경쟁률</h3><p>공개된 경쟁률 정보 없음</p><small>공식 원문으로 확인한 채용자료만 표시합니다.</small></div>';
  const denominator=compact?(record.stage.includes('ALIO')?'최종 선발':'공고 모집'):record.denominatorLabel || '모집';
  const numerator=record.numeratorLabel || '지원인원';
  const stage=compact&&record.stage.includes('ALIO')?'1차 응시인원 ÷ 최종 선발인원 기준':record.stage;
  const counts = Number.isFinite(record.openings)&&Number.isFinite(record.applicants)?`${denominator} ${formatNumber(record.openings)}명 / ${numerator} ${formatNumber(record.applicants)}명`:'모집·지원 인원 일부 비공개';
  return `<div class="competition-summary"><div class="competition-heading"><h3>🎯 ${compact?'최근 확인한':'공개'} 채용 경쟁률</h3><strong>${formatNumber(record.ratio)} <span>: 1</span></strong></div><p><b>${record.year}년 ${escapeHTML(record.jobTitle)}</b> · ${escapeHTML(record.employmentType || '고용형태 미표기')}</p><p>${escapeHTML(record.period || '모집 시기 미표기')} · ${escapeHTML(stage)}</p><p>${escapeHTML(counts)}</p><small>해당 채용·직무·단계의 과거 수치입니다. 개인 합격 가능성이나 추첨 확률을 뜻하지 않습니다. 부산 사업장과 모집 지역이 다를 수 있습니다.</small>${!compact?`<p>${escapeHTML(record.note || '')}</p>${record.scope?`<p class="competition-scope"><b>전형·지역 범위</b><br>${escapeHTML(record.scope)}</p>`:''}${record.advertisedWorkRegions?.length?`<p class="scope-note">공고 전체 근무지: ${record.advertisedWorkRegions.map(escapeHTML).join(' · ')}<br>${escapeHTML(record.regionDefinition || '')}</p>`:''}`:record.scope?.includes('학력 소재지')?'<p class="competition-scope">수도권은 지원자의 학력 소재지 구분입니다. 공고 근무지는 전국·해외입니다.</p>':''}${sourceLink(record.sourceUrl,compact?'공식 채용자료':record.sourceTitle || '공식 채용자료')}</div>`;
}
function renderSources(company) {
  const labels={name:'기업명',legalName:'법인명',officialWebsite:'공식 홈페이지',address:'부산 주소',district:'구·군',locationType:'본사·사업장 구분',headquarters:'본사 주소',industryLabel:'주요 사업',introduction:'기업 소개',companySize:'기업 형태',employees:'전체 인원',busanEmployees:'부산 인원',workforce:'인원 집계',averageSalary:'평균 연봉·보수',startingSalary:'신입 초봉',averageTenure:'평균 근속',established:'설립·출범',establishedDate:'설립일',historyMilestones:'기관·회사 연혁',benefits:'복리후생',workSystems:'근무제도',financials:'재무',listing:'상장 여부',recruitmentCompetition:'채용 경쟁률',blind:'기업 평가 링크'};
  Object.assign(labels,{establishedBasis:'설립·출범 기준',performancePay:'성과급 안내',regularEmployees:'정규직 인원',listingStatus:'상장 여부',competition:'채용 경쟁률'});
  return company.sources.map(s=>`<div class="source-item">${sourceLink(s.url,s.title)}<small>자료 기준: ${s.referenceYear?`${s.referenceYear}년`:'원문 갱신연도 미표기'} · 확인일 ${escapeHTML(s.accessedAt)}<br>확인 항목: ${[...new Set(s.fields.map(key=>escapeHTML(labels[key] || (key.startsWith('recruitmentCompetition.')?'채용 전형·지역 범위':key.startsWith('review.')?'재검토 기록':'보충자료'))))].join(', ')}</small>${s.scope?`<p>${escapeHTML(s.scope)}</p>`:''}</div>`).join('') + renderReviews(company.research?.reviews);
}
function renderReviews(reviews=[]) {
  return reviews.map(review=>`<details class="research-log review-log"><summary>종합 고도화 재검토 · ${escapeHTML(review.checkedAt || '확인일 미표기')}</summary><p class="scope-note">기존 데이터 검토와 새 출처 조회를 구분했습니다. 재조회하지 않은 이전 자료를 최신 자료로 다시 검증한 것은 아닙니다.</p><ul>${(review.findings || []).map(f=>`<li>${escapeHTML(typeof f==='string'?f:f.detail || f.scope || f.result)}</li>`).join('')}</ul><h4>추가 확인 경로</h4><ol>${(review.paths || []).map(p=>{const local=p.mode==='local-review'||p.newlyAccessed===false;const url=p.url || (/^https?:/.test(p.path || '')?p.path:null);return `<li><b>${local?'이전 기록 검토':escapeHTML(p.channel || '공식 원문 재확인')}</b><p>${escapeHTML(p.outcome || '')}</p>${url?sourceLink(url,'추가 확인 경로'):!local&&p.queryOrPath?`<p>${escapeHTML(p.queryOrPath)}</p>`:''}</li>`;}).join('')}</ol>${(review.limitations || []).map(note=>`<p class="scope-note">${escapeHTML(note)}</p>`).join('')}</details>`).join('');
}
function workforceRecords(c) {
  const records=[...(c.workforce || [])];
  for(const item of [c.busanEmployees,c.employees]) if(item && !records.some(x=>x.sourceUrl===item.sourceUrl && x.year===item.year && x.value===item.value))records.unshift(item);
  return records;
}
export function renderCompanyDetail(company) {
  const c=company;
  const workforce=workforceRecords(c);
  const recruitment=[...(c.recruitmentCompetition || [])].filter(r=>r.verification==='verified').sort(compareCompetitionDates);
  const timeline=c.historyMilestones?.length?c.historyMilestones:(c.established?[{date:c.established,event:c.establishedBasis || '설립·출범'}]:[]);
  const finance=c.financials || [];
  const statusLabel={verified:'확보 및 출처 검증 완료',needs_verification:'자료 발견, 검증 필요',unavailable:'공개자료 확인 불가',restricted:'접근 또는 이용 제한'};
  const researchKeys={salary:'평균 연봉·보수',startingSalary:'신입 초봉',tenure:'평균 근속',employees:'직원 수',busanEmployees:'부산 인원',established:'설립·출범',benefits:'복리후생',competition:'채용 경쟁률',blind:'블라인드 기업 링크',financials:'연간 재무정보'};
  return `<div class="company-detail-sections">
    <section class="detail-section"><h3>기업 소개</h3><p class="company-introduction">${escapeHTML(c.introduction || `${c.industryLabel} 관련 제품·서비스를 제공하는 부산 소재 기업·기관입니다. 세부 사업 내용은 연결된 공식 출처에서 확인해 주세요.`)}</p><div class="detail-grid">${field('법인·운영상호',c.legalName || c.name)}${field('공식 홈페이지',c.officialWebsite?'아래 링크에서 확인':'미확인')}${field('본사 소재지',typeof c.headquarters==='string'?c.headquarters:null)}${field('부산 사업장',c.address)}</div>${c.officialWebsite?`<div class="official-site">${sourceLink(c.officialWebsite,'공식 홈페이지 방문')}</div>`:''}${timeline.length?`<h4>확인한 연혁</h4><ol class="company-timeline">${timeline.map(t=>`<li><b>${escapeHTML(t.date)}</b><span>${escapeHTML(t.event)}</span></li>`).join('')}</ol>`:'<p class="muted">공식 연혁 정보 없음</p>'}${c.institutionalOrigin?`<p class="scope-note">전신 포함 역사 기점: ${escapeHTML(c.institutionalOrigin.date)} · ${escapeHTML(c.institutionalOrigin.basis)}. 현 기관 설립·출범과 구분합니다.</p>`:''}</section>
    <section class="detail-section"><h3>기업 규모와 재무</h3><div class="detail-grid">${field('기업 형태',c.companySize)}${field('상장 여부',c.listing?.status, c.listing?[c.listing.market,c.listing.stockCode,c.listing.asOf].filter(Boolean).join(' · '):'')}${field('부산 사업장 인원',c.busanEmployees?`${formatNumber(c.busanEmployees.value)}명`:null,c.busanEmployees?measurementNote(c.busanEmployees):'전국 회사 인원을 대입하지 않습니다.')}</div><h4>인원 집계의 범위</h4>${workforce.length?workforce.map(w=>metricDetail(w.definition || '직원 수',w,`${formatNumber(w.value)}명`)).join(''):'<p class="muted">기준시점과 집계 범위를 확인한 직원 수 정보 없음</p>'}${finance.length?`<div class="table-scroll"><table class="method-table finance-table"><caption>확인한 연간 재무정보 · 단위: 원</caption><thead><tr><th>연도·범위</th><th>매출액 / 영업수익</th><th>영업이익</th><th>당기순이익</th></tr></thead><tbody>${finance.map(f=>`<tr><th>${f.year}년<br>${escapeHTML(f.basis)}<br>${escapeHTML(f.scope || '')}</th><td>${f.revenueKRW===null||f.revenueKRW===undefined?'정보 없음':formatNumber(f.revenueKRW)}</td><td>${f.operatingProfitKRW===null||f.operatingProfitKRW===undefined?'정보 없음':formatNumber(f.operatingProfitKRW)}</td><td>${f.netIncomeKRW===null||f.netIncomeKRW===undefined?'정보 없음':formatNumber(f.netIncomeKRW)}</td></tr>`).join('')}</tbody></table></div>${finance.map(f=>`<p class="scope-note">${f.year}년 · ${escapeHTML(f.basis)} · ${sourceLink(f.sourceUrl,'재무 원문')}<br>${escapeHTML(f.note || '')}</p>`).join('')}`:'<p class="muted">원문으로 검증한 연간 재무 수치 없음</p>'}</section>
    <section class="detail-section"><h3>근무환경</h3><div class="detail-grid">${metricDetail('평균 연봉·보수',c.averageSalary,c.averageSalary?`${formatNumber(c.averageSalary.valueKRW)}원`:'')}${metricDetail('신입 초봉',c.startingSalary,c.startingSalary?`${formatNumber(c.startingSalary.valueKRW)}원`:'')}${metricDetail('평균 근속',c.averageTenure,c.averageTenure?(c.averageTenure.originalUnit==='개월'?`${formatNumber(c.averageTenure.originalValue)}개월 (약 ${formatNumber(c.averageTenure.valueYears)}년)`:`${formatNumber(c.averageTenure.valueYears)}년`):'')}</div><h4>공식 복리후생</h4>${c.benefits?.length?`<ul class="benefit-list">${c.benefits.map(b=>`<li>${escapeHTML(typeof b==='string'?b:b.label)}</li>`).join('')}</ul><p class="scope-note">자료 게시 시점의 안내입니다. 고용형태·직무별 적용조건과 현재 운영 여부는 공식 채용자료에서 확인해 주세요.</p>`:'<p class="muted">공식 출처로 확인한 복리후생 정보 없음</p>'}<h4>근무시간·제도</h4>${c.workSystems?.length?`<ul>${c.workSystems.map(w=>`<li>${escapeHTML(typeof w==='string'?w:[w.label,w.description].filter(Boolean).join(' · '))}${w.year?` (${w.year}년)`:''}${w.sourceUrl?` · ${sourceLink(w.sourceUrl)}`:''}</li>`).join('')}</ul>`:'<p class="muted">공식적으로 확인한 근무제도 정보 없음</p>'}<h4>성과급 안내</h4><p>${escapeHTML(c.performancePay?.description || '독립적으로 확인한 성과급 제도·지급액 정보 없음')}</p></section>
    <section class="detail-section"><h3>채용정보</h3>${recruitment.length?recruitment.map(r=>renderCompetition(r,false)).join(''):renderCompetition(null)}<p class="scope-note">채용 경쟁률은 기업 설명용 정보이며 두 가지 추첨 모드의 가중치 계산에 사용하지 않습니다.</p></section>
    <section class="detail-section"><h3>기업 평가</h3><p><span class="stars" aria-hidden="true">☆☆☆☆☆</span> 평점 정보 없음</p><p>블라인드 평점·리뷰·추천율은 사용 권한을 확보하지 않아 제공하지 않습니다.</p>${c.blind?.companyUrl?sourceLink(c.blind.companyUrl,'확인한 블라인드 기업 페이지'):'<p class="muted">정확한 기업별 블라인드 페이지 미확인</p>'}</section>
    <section class="detail-section"><h3>정보 출처와 확인 범위</h3>${renderSources(c)}${(c.notes || []).map(n=>`<p class="scope-note">${escapeHTML(n)}</p>`).join('')}<p class="scope-note">업종은 주요 활동에 대응한 탐색용 대분류이며 공식 등록 KSIC 검증값이 아닙니다. 자료는 출처의 기준시점 정보이며 현재 채용·영업 상태를 보증하지 않습니다.</p>${c.research?`<details class="research-log"><summary>기업별 조사 현황과 확인 경로</summary><dl class="research-status">${Object.entries(researchKeys).map(([key,label])=>`<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(statusLabel[c.research.status?.[key]] || '조사 기록 확인 필요')}</dd></div>`).join('')}</dl><ol>${(c.research.attempts || []).map(a=>`<li><b>${escapeHTML(a.channel)}</b> · ${escapeHTML(a.queryOrPath || '')}<p>${escapeHTML(a.outcome)}</p>${a.url?sourceLink(a.url,'확인 경로'):''}</li>`).join('')}</ol></details>`:''}</section>
  </div>`;
}
export function renderCompanySummary(company,event,context,options) {
  const c=company, salary=c.averageSalary, tenure=c.averageTenure, first=c.startingSalary;
  const employee=c.busanEmployees || c.employees;
  const employeeLabel=c.busanEmployees?'부산 사업장 인원':'전체 인원 · 부산 한정 아님';
  const latest=latestCompetition(c);
  const normalizeLegal=name=>String(name).replaceAll('주식회사','').replaceAll('(주)','').replaceAll('㈜','').replaceAll(' ','');
  const legalNotice=c.legalName && normalizeLegal(c.legalName)!==normalizeLegal(c.name) ? `<p class="legal-name-note">확인한 법인·운영상호: <strong>${escapeHTML(c.legalName)}</strong></p>` : '';
  const nameTag=c.name.replace(/\(주\)|주식회사|㈜|\s/g,'').slice(0,1);
  const message=event?.context==='shared'?'공유받은 기업을 확인해 보세요.':event?.context==='history'?'이전에 만난 회사를 다시 보고 있어요.':'축하합니다! 새로운 회사에 취업했습니다.';
  const probability=event?`<div class="probability-strip"><div><span>이 결과의 당첨 확률</span><small>${escapeHTML(options.modeNames[event.mode])} · ${event.mode==='weighted'?`${options.statsYear}년 통계`:'수록 기업 기준'}</small></div><strong>${formatProbability(event.probability)}</strong><button type="button" class="text-button methodology-trigger">계산 보기 ↗</button></div><p class="scope-note">모집단: ${escapeHTML(event.filters.district || '부산 전체')} · ${escapeHTML(event.filters.industry?options.sectorLabel(event.filters.industry):'모든 수록 업종')} · ${event.poolSize ?? '기록 당시'}개 기업. 실제 채용 확률이 아닙니다.${event.context==='history'?' 추첨 확률은 저장 당시 기준이며 기업정보는 현재 데이터입니다.':''}</p>`:'';
  return `<div class="result-body"><div class="result-success">${escapeHTML(message)}</div><div class="company-heading"><div class="company-monogram" aria-hidden="true">${escapeHTML(nameTag)}</div><div><h2>${escapeHTML(c.name)}</h2><p>부산광역시 ${escapeHTML(c.district)} · ${escapeHTML(options.sectorLabel(c.industryCode))}</p></div></div><div class="company-tags"><span class="tag">${escapeHTML(c.companySize || '기업 규모 정보 없음')}</span><span class="tag">${escapeHTML(c.locationType)}</span></div>
    ${legalNotice}<div class="result-metrics">${metric('평균 연봉·보수',salary?formatNumber(salary.valueKRW/10000):null,salary?'만원':'',salary?`${measurementNote(salary)} / ${salary.displayDefinition || salary.definition}`:'검증된 자료 없음')}${metric('신입 초봉',first?formatNumber(first.valueKRW/10000):null,first?'만원':'',first?measurementNote(first):'평균 보수와 별도 항목')}${metric('평균 근속',tenure?formatNumber(tenure.valueYears):null,tenure?'년':'',tenure?measurementNote(tenure):'검증된 자료 없음')}</div>
    <div class="facts basic-facts">${field('업종 · 주요 제품/서비스',c.industryLabel)}${field('설립·출범',c.established,c.establishedBasis)}${field(employeeLabel,employee?`${formatNumber(employee.value)}명`:null,employee?`${measurementNote(employee)} · ${employee.definition}`:'부산/전국 인원을 구분해 확인합니다.')}${field('공식 복리후생',c.benefits?.length?c.benefits.slice(0,3).map(b=>typeof b==='string'?b:b.label).join(' · '):null,c.benefits?.length>3?`외 ${c.benefits.length-3}개 · 상세정보에서 확인`:'')}</div>
    ${renderCompetition(latest,true)}<div class="blind-note"><span><span class="stars" aria-hidden="true">☆☆☆☆☆</span> 평점 정보 없음</span>${c.blind?.companyUrl?sourceLink(c.blind.companyUrl,'블라인드 기업 페이지'):'<span>기업별 링크 미확인</span>'}</div>${probability}
    <button type="button" class="expand-detail" data-expand="${escapeHTML(c.id)}" aria-expanded="false" aria-controls="expanded-company-detail">기업 상세정보 보기 <span>＋</span></button><div id="expanded-company-detail" class="expanded-company-detail" hidden>${renderCompanyDetail(c)}</div>
    ${context==='directory'?'':`<div class="result-actions"><button type="button" data-action="share">↗ 결과 링크 공유</button><button type="button" data-action="compare">≋ 최근 회사와 비교</button></div>`}
    <p class="result-source-caption">자료 출처 ${c.sources.length}건 · 기준연도·확인일·집계 범위는 기업 상세정보에서 확인할 수 있습니다.</p></div>`;
}
