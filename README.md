# PinWith

아는 곳을 지도에 핀으로 모아, 링크 하나로 건네는 서비스. 누구나 서로에게 큐레이터가 된다.

## 구조

- `src/app` — Next.js 앱 라우트
  - `/` 랜딩, `/demo` 예시 리스트(서버 연결 없이 동작)
  - `/@handle` 큐레이터 홈, `/@handle/slug` 리스트 화면(지도/목록 전환)
  - `/login`, `/auth/callback` 로그인(구글, 이메일 링크)
  - `/me` 내 프로필(핸들)과 내 리스트, `/me/lists/[id]` 리스트 편집(장소 검색·추가, 섹션, 메모, 순서)
- `src/components` — `ListExplorer`(리스트 화면), `PlaceMap`(MapLibre 지도), `ListEditor`·`PlacePicker`(편집, 구글 장소 검색), `MyPage`
- `src/lib` — Supabase 클라이언트, 데이터 조회, 외부 지도 링크, 탭 기록
- `supabase/migrations` — DB 스키마와 행 단위 권한(RLS)

## 지도와 구글 데이터 원칙 (기획안 4.5)

- 지도는 OpenStreetMap 기반 타일(MapLibre). 구글 지도 JavaScript는 쓰지 않는다.
- 장소 검색은 Google Places UI Kit. place_id만 영구 저장하고 좌표는 30일만 캐시한다.
- 장소 상세와 길찾기는 구글·네이버·카카오 지도 링크로 넘긴다.

## 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev
```

환경 변수가 비어 있으면 `/demo`만 동작한다.

## Supabase 로그인 설정

대시보드 → Authentication → URL Configuration에서
Site URL과 Redirect URLs에 `http://localhost:3000/**`(배포 후에는 서비스 주소)를 넣는다.
이메일 링크 로그인은 기본으로 켜져 있고, 구글 로그인은 Providers에서 Google을 켜야 한다.
