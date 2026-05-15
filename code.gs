/** STREAMING_CHUNK:페이지 렌더링 함수 */
/**
 * 웹 앱 접속 시 실행되는 함수
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('TechBridge Insights | 기술사업화 플랫폼')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** STREAMING_CHUNK:클라이언트 호출 메인 함수 */
/**
 * 프론트엔드에서 호출하는 최신 뉴스 가져오기 함수
 */
function fetchLatestNews() {
  try {
    // API 키 없이 구글 뉴스 RSS를 직접 호출합니다.
    var koreaNews = getGoogleNewsRSS('기술사업화 OR 기술이전 OR 딥테크 투자', 'ko', 'KR', 'KR:ko', 4, false);

    // 미국 동향: 미국 대학 스포츠 이적(transfer portal, basketball 등) 노이즈 제외, 스타트업/특허/상용화 중심
    var usQuery = '("technology commercialization" OR "technology transfer") AND (startup OR patent OR commercialization) -"transfer portal" -"basketball" -"football" -"sports"';
    var usNews = getGoogleNewsRSS(usQuery, 'en', 'US', 'US:en', 3, true);
    usNews.forEach(function(n) { n.country = "USA"; });

    // 중국 동향: 중국어 키워드(기술상업화, 과학기술성과전환)로 직접 검색하여 정확도 상향
    var cnQuery = '技术商业化 OR 科技成果转化 OR 技术转移';
    var cnNews = getGoogleNewsRSS(cnQuery, 'zh-CN', 'CN', 'CN:zh-CN', 2, true);
    cnNews.forEach(function(n) { n.country = "CHINA"; });

    // 미국과 중국 뉴스를 합쳐서 글로벌 동향으로 전달
    var globalNews = usNews.concat(cnNews);

    var msitNews = getGoogleNewsRSS('과기정통부 (기술사업화 OR 기술이전 OR 보도자료)', 'ko', 'KR', 'KR:ko', 3, false);
    var motieNews = getGoogleNewsRSS('산업부 (기술사업화 OR 기술이전 OR 보도자료)', 'ko', 'KR', 'KR:ko', 3, false);
    var mssNews = getGoogleNewsRSS('중기부 (기술사업화 OR 기술이전 OR 보도자료)', 'ko', 'KR', 'KR:ko', 3, false);

    return {
      korea: koreaNews,
      global: globalNews,
      msit: msitNews,
      motie: motieNews,
      mss: mssNews
    };
  } catch (error) {
    throw new Error("구글 뉴스 스크리닝 중 오류가 발생했습니다: " + error.toString());
  }
}

/** STREAMING_CHUNK:구글 뉴스 RSS 파싱 함수 */
/**
 * 구글 뉴스 RSS 피드를 가져와서 JSON 형태로 변환하는 헬퍼 함수
 */
function getGoogleNewsRSS(query, hl, gl, ceid, limit, doTranslate) {
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=' + hl + '&gl=' + gl + '&ceid=' + ceid;
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var xml = response.getContentText();

  // XML 파싱
  var document = XmlService.parse(xml);
  var root = document.getRootElement();
  var channel = root.getChild('channel');
  var items = channel.getChildren('item');

  var newsList = [];
  var max = Math.min(limit, items.length);

  for (var i = 0; i < max; i++) {
    var item = items[i];
    var titleFull = item.getChildText('title');
    var link = item.getChildText('link');
    var pubDate = item.getChildText('pubDate');

    // "기사 제목 - 언론사" 형태에서 제목과 언론사 분리
    var splitIndex = titleFull.lastIndexOf(' - ');
    var title = splitIndex > -1 ? titleFull.substring(0, splitIndex) : titleFull;
    var source = splitIndex > -1 ? titleFull.substring(splitIndex + 3) : "Google News";

    if (doTranslate) {
      try {
        // Apps Script 기본 번역 기능을 활용해 원문을 한글로 번역 ('': 소스 언어 자동 감지)
        title = LanguageApp.translate(title, '', 'ko');
      } catch(e) {
        // 일일 번역 할당량 초과 시 원문 유지
      }
    }

    // 날짜 포맷팅 (YYYY.MM.DD)
    var dateObj = new Date(pubDate);
    var dateStr = Utilities.formatDate(dateObj, "Asia/Seoul", "yyyy.MM.dd");

    newsList.push({
      id: i,
      category: hl === 'ko' ? "실시간 동향" : undefined,
      country: hl === 'en' ? "Global" : undefined,
      title: title,
      summary: "기사를 클릭하여 구글 뉴스로 이동 후 상세 내용을 확인하세요.",
      source: source,
      date: dateStr,
      link: link
    });
  }

  return newsList;
}
