const { XMLParser } = require('fast-xml-parser');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q 파라미터가 필요합니다.' });

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await response.text();

    const parser = new XMLParser();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item ?? [];
    const list = Array.isArray(items) ? items : [items];
    const max = Math.min(5, list.length);

    const newsList = [];
    for (let i = 0; i < max; i++) {
      const item = list[i];
      const titleFull = item.title ?? '';
      const link = item.link ?? '#';
      const pubDate = item.pubDate ?? '';

      const splitIndex = titleFull.lastIndexOf(' - ');
      const title = splitIndex > -1 ? titleFull.substring(0, splitIndex) : titleFull;
      const source = splitIndex > -1 ? titleFull.substring(splitIndex + 3) : 'Google News';

      const dateObj = new Date(pubDate);
      const dateStr = isNaN(dateObj) ? '' : dateObj.toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul'
      }).replace(/\. /g, '.').replace('.', '');

      newsList.push({ id: i, title, source, date: dateStr, link });
    }

    res.status(200).json(newsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
