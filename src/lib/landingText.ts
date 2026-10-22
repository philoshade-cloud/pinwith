import { LANG_IDS, type Lang } from "@/lib/i18n/core";

// 도시별 소개 페이지 문구. 서버가 그 언어로 바로 그린다(검색엔진이 언어마다 제대로 읽게).
// 칸 순서는 LANG_IDS(ko|en|ja|zh-CN|zh-TW|es|pt|fr|de|it|ru|ar|hi|tr|th|vi|id). {city}·{n}은 바꿔 넣는다.
const T = {
  title: [
    "{city} 가볼 만한 곳 · 지도 리스트 모음",
    "Things to do in {city} — map lists",
    "{city}のおすすめスポット・地図リスト",
    "{city}好去处 · 地图清单",
    "{city}好去處 · 地圖清單",
    "Qué ver en {city}: listas en el mapa",
    "O que fazer em {city}: listas no mapa",
    "Que faire à {city} : listes sur la carte",
    "{city}: Sehenswertes als Kartenlisten",
    "Cosa fare a {city}: liste sulla mappa",
    "{city}: интересные места на карте",
    "أماكن تستحق الزيارة في {city} · قوائم على الخريطة",
    "{city} में घूमने की जगहें · मैप लिस्ट",
    "{city}: gezilecek yerler haritada",
    "ที่เที่ยว{city} · ลิสต์บนแผนที่",
    "Địa điểm nên đến ở {city} · danh sách trên bản đồ",
    "Tempat menarik di {city} · daftar di peta",
  ],
  intro: [
    "PinWith 사람들이 직접 다녀와 지도에 꽂은 {city} 리스트 {n}개. 리스트를 열면 모든 장소를 지도에서 한 번에 볼 수 있어요.",
    "{n} lists of places in {city}, pinned on the map by people on PinWith. Open a list to see every spot on one map.",
    "PinWithのユーザーが地図にピンを刺した{city}のリスト{n}件。リストを開くと、すべてのスポットを1つの地図で見られます。",
    "PinWith 用户在地图上标注的{city}清单共 {n} 个。打开清单，即可在一张地图上查看所有地点。",
    "PinWith 使用者在地圖上標記的{city}清單共 {n} 個。打開清單，就能在一張地圖上看到所有地點。",
    "{n} listas de lugares en {city}, marcadas en el mapa por personas de PinWith. Abre una lista para ver todos los sitios en un solo mapa.",
    "{n} listas de lugares em {city}, marcadas no mapa por pessoas do PinWith. Abra uma lista para ver todos os lugares em um só mapa.",
    "{n} listes de lieux à {city}, épinglées sur la carte par des membres de PinWith. Ouvrez une liste pour voir tous les lieux sur une seule carte.",
    "{n} Listen mit Orten in {city}, von PinWith-Nutzern auf der Karte markiert. Öffne eine Liste, um alle Orte auf einer Karte zu sehen.",
    "{n} liste di luoghi a {city}, segnate sulla mappa dagli utenti di PinWith. Apri una lista per vedere tutti i posti su un'unica mappa.",
    "{city}: списки мест от пользователей PinWith ({n}). Откройте список, чтобы увидеть все места на одной карте.",
    "{n} قوائم لأماكن في {city} وضعها مستخدمو PinWith على الخريطة. افتح أي قائمة لترى كل الأماكن على خريطة واحدة.",
    "{city} की {n} लिस्ट, जिन्हें PinWith के लोगों ने मैप पर पिन किया है। किसी लिस्ट को खोलें और सारी जगहें एक ही मैप पर देखें।",
    "{city} için PinWith kullanıcılarının haritaya işaretlediği {n} liste. Tüm yerleri tek haritada görmek için bir liste açın.",
    "ลิสต์สถานที่ใน{city} {n} ลิสต์ ที่ผู้ใช้ PinWith ปักหมุดไว้บนแผนที่ เปิดลิสต์เพื่อดูทุกที่บนแผนที่เดียว",
    "{n} danh sách địa điểm ở {city} do người dùng PinWith ghim trên bản đồ. Mở một danh sách để xem mọi địa điểm trên cùng một bản đồ.",
    "{n} daftar tempat di {city} yang dipin di peta oleh pengguna PinWith. Buka daftar untuk melihat semua tempat dalam satu peta.",
  ],
  others: [
    "다른 언어로 된 리스트", "Lists in other languages", "他の言語のリスト", "其他语言的清单", "其他語言的清單", "Listas en otros idiomas",
    "Listas em outros idiomas", "Listes dans d'autres langues", "Listen in anderen Sprachen", "Liste in altre lingue", "Списки на других языках",
    "قوائم بلغات أخرى", "दूसरी भाषाओं में लिस्ट", "Diğer dillerdeki listeler", "ลิสต์ภาษาอื่น", "Danh sách bằng ngôn ngữ khác", "Daftar dalam bahasa lain",
  ],
  openMap: [
    "지도에서 보기", "Open on the map", "地図で見る", "在地图上查看", "在地圖上查看", "Ver en el mapa", "Ver no mapa", "Voir sur la carte",
    "Auf der Karte ansehen", "Vedi sulla mappa", "Открыть на карте", "افتح على الخريطة", "मैप पर देखें", "Haritada aç", "ดูบนแผนที่", "Xem trên bản đồ", "Lihat di peta",
  ],
  otherCities: [
    "다른 도시", "Other cities", "他の都市", "其他城市", "其他城市", "Otras ciudades", "Outras cidades", "Autres villes", "Weitere Städte", "Altre città",
    "Другие города", "مدن أخرى", "दूसरे शहर", "Diğer şehirler", "เมืองอื่น", "Thành phố khác", "Kota lainnya",
  ],
  indexTitle: [
    "도시별 지도 리스트", "Map lists by city", "都市別の地図リスト", "按城市浏览地图清单", "依城市瀏覽地圖清單", "Listas en el mapa por ciudad",
    "Listas no mapa por cidade", "Listes sur la carte par ville", "Kartenlisten nach Stadt", "Liste sulla mappa per città", "Списки мест по городам",
    "قوائم على الخريطة حسب المدينة", "शहर के हिसाब से मैप लिस्ट", "Şehre göre harita listeleri", "ลิสต์บนแผนที่ตามเมือง", "Danh sách trên bản đồ theo thành phố", "Daftar peta per kota",
  ],
  indexIntro: [
    "PinWith 사람들이 만든 장소 리스트를 도시별로 모았어요.",
    "Place lists made by people on PinWith, grouped by city.",
    "PinWithのユーザーが作ったスポットリストを都市別にまとめました。",
    "按城市整理的 PinWith 用户地点清单。",
    "依城市整理的 PinWith 使用者地點清單。",
    "Listas de lugares creadas por personas de PinWith, agrupadas por ciudad.",
    "Listas de lugares criadas por pessoas do PinWith, agrupadas por cidade.",
    "Des listes de lieux créées par les membres de PinWith, classées par ville.",
    "Ortslisten von PinWith-Nutzern, nach Stadt sortiert.",
    "Liste di luoghi create dagli utenti di PinWith, divise per città.",
    "Списки мест от пользователей PinWith, по городам.",
    "قوائم أماكن أنشأها مستخدمو PinWith، مرتبة حسب المدينة.",
    "PinWith के लोगों की बनाई जगहों की लिस्ट, शहर के हिसाब से।",
    "PinWith kullanıcılarının hazırladığı yer listeleri, şehirlere göre.",
    "ลิสต์สถานที่ที่ผู้ใช้ PinWith สร้างไว้ แยกตามเมือง",
    "Danh sách địa điểm do người dùng PinWith tạo, xếp theo thành phố.",
    "Daftar tempat buatan pengguna PinWith, dikelompokkan per kota.",
  ],
  lists: [
    "리스트 {n}개", "{n} lists", "{n}件のリスト", "{n} 个清单", "{n} 個清單", "{n} listas", "{n} listas", "{n} listes", "{n} Listen", "{n} liste",
    "Списков: {n}", "{n} قوائم", "{n} लिस्ट", "{n} liste", "{n} ลิสต์", "{n} danh sách", "{n} daftar",
  ],
  cta: [
    "PinWith에서 나만의 지도 리스트 만들기", "Make your own map list on PinWith", "PinWithで自分の地図リストを作る", "在 PinWith 制作自己的地图清单",
    "在 PinWith 製作自己的地圖清單", "Crea tu propia lista en el mapa con PinWith", "Crie sua própria lista no mapa com o PinWith",
    "Créez votre propre liste sur la carte avec PinWith", "Erstelle deine eigene Kartenliste mit PinWith", "Crea la tua lista sulla mappa con PinWith",
    "Создайте свой список мест в PinWith", "أنشئ قائمتك الخاصة على الخريطة في PinWith", "PinWith पर अपनी मैप लिस्ट बनाएं",
    "PinWith'te kendi harita listeni oluştur", "สร้างลิสต์บนแผนที่ของคุณเองที่ PinWith", "Tạo danh sách bản đồ của riêng bạn trên PinWith", "Buat daftar peta sendiri di PinWith",
  ],
} satisfies Record<string, string[]>;

export type LandingKey = keyof typeof T;

export function lt(lang: Lang, key: LandingKey, vars: Record<string, string | number> = {}): string {
  const s = T[key][LANG_IDS.indexOf(lang)] ?? T[key][1];
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
