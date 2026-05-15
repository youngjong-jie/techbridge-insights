const { XMLParser } = require('fast-xml-parser');

async function translateToKorean(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(s => s[0]).join('');
  } catch {
    return text;
  }
}

async function getGoogleNewsRSS(query, hl, gl, ceid, limit, doTranslate) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const xml = await res.text();

  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  const max = Math.min(limit, list.length);

  const newsList = [];
  for (let i = 0; i < max; i++) {
    const item = list[i];
    const titleFull = item.title ?? '';
    const link = item.link ?? '#';
    const pubDate = item.pubDate ?? '';

    const splitIndex = titleFull.lastIndexOf(' - ');
    let title = splitIndex > -1 ? titleFull.substring(0, splitIndex) : titleFull;
    const source = splitIndex > -1 ? titleFull.substring(splitIndex + 3) : 'Google News';

    if (doTranslate) {
      title = await translateToKorean(title);
    }

    const dateObj = new Date(pubDate);
    const dateStr = isNaN(dateObj) ? '' : dateObj.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul'
    }).replace(/\. /g, '.').replace('.', '');

    newsList.push({
      id: i,
      category: hl === 'ko' ? '실시간 동향' : undefined,
      country: hl !== 'ko' ? undefined : undefined,
      title,
      summary: '기사를 클릭하여 구글 뉴스로 이동 후 상세 내용을 확인하세요.',
      source,
      date: dateStr,
      link,
    });
  }
  return newsList;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const koreaNews = await getGoogleNewsRSS('기술사업화 OR 기술이전 OR 딥테크 투자', 'ko', 'KR', 'KR:ko', 4, false);

    const usQuery = '("technology commercialization" OR "technology transfer") AND (startup OR patent OR commercialization) -"transfer portal" -"basketball" -"football" -"sports"';
    const usNews = await getGoogleNewsRSS(usQuery, 'en', 'US', 'US:en', 3, true);
    usNews.forEach(n => { n.country = 'USA'; });

    const cnQuery = '技术商业化 OR 科技成果转化 OR 技术转移';
    const cnNews = await getGoogleNewsRSS(cnQuery, 'zh-CN', 'CN', 'CN:zh-CN', 2, true);
    cnNews.forEach(n => { n.country = 'CHINA'; });

    const globalNews = [...usNews, ...cnNews];

    const msitNews = await getGoogleNewsRSS('과기정통부 (기술사업화 OR 기술이전 OR 보도자료)', 'ko', 'KR', 'KR:ko', 3, false);
    const motieNews = await getGoogleNewsRSS('산업부 (기술사업화 OR 기술이전 OR 보도자료)', 'ko', 'KR', 'KR:ko', 3, false);
    const mssNews = await getGoogleNewsRSS('중기부 (기술사업화 OR 기술이전 OR 보도자료)', 'ko', 'KR', 'KR:ko', 3, false);

    res.status(200).json({ korea: koreaNews, global: globalNews, msit: msitNews, motie: motieNews, mss: mssNews });
  } catch (error) {
    res.status(500).json({ error: '구글 뉴스 스크리닝 중 오류가 발생했습니다: ' + error.message });
  }
};
