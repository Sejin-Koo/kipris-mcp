# kipris-mcp

KIPRIS Plus(지식재산처) 특허·실용신안 / 디자인 / 상표 3개 출원인 검색 서비스를
하나의 MCP 서버로 통합합니다.

## 왜 필요한가

KIPRIS Plus 3개 서비스는 같은 accessKey를 쓰지만 오퍼레이션명·파라미터명이
서비스마다 미묘하게 다르고, 총건수 필드명도 다릅니다. 실수하기 쉬운 부분을
이 서버가 흡수해서 클라이언트(에이전트)는 신경 쓰지 않아도 됩니다.

| 서비스 | 오퍼레이션명 | 출원인 파라미터명 | 총건수 필드 |
|---|---|---|---|
| 특허/실용신안 (patUtiModInfoSearchSevice) | applicantNameSearchInfo | `applicant` | TotalSearchCount |
| 디자인 (designInfoSearchService) | applicantNameSearchInfo | `applicantName` | totalCount (소문자 시작 — 다름) |
| 상표 (trademarkInfoSearchService) | applicantNamesearchInfo (소문자 s) | `applicantName` | TotalSearchCount |

도메인은 항상 `plus.kipris.or.kr` (kipo-api.kipi.or.kr 아님).

## 엔드포인트

```
https://kipris-mcp.vercel.app/api/mcp
```

인증 불필요 (서버가 자체적으로 `KIPRIS_ACCESS_KEY` 환경변수를 보유).

## 환경변수 (Vercel)

```
KIPRIS_ACCESS_KEY=<KIPRIS Plus 발급키>
```

키 값은 저장소에 두지 않는다 (Vercel 환경변수에만 등록). 이전 버전 README에 값이
평문으로 적혀 있었으므로, 공개 이력이 남은 그 키는 KIPRIS Plus에서 재발급하는 것이 안전하다.

## 제공 도구 (9개)

1. **search_patents({ applicant, numOfRows?, pageNo? })**
   특허/실용신안 출원인 검색. 발명의명칭, 출원/공개/등록 번호·일자, 등록상태, IPC코드, 초록 반환.
2. **search_designs({ applicant, numOfRows?, pageNo? })**
   디자인 출원인 검색. 물품명, 출원/공개/등록 번호·일자, 출원상태, 디자인번호, 창작자명 반환.
3. **search_trademarks({ applicant, numOfRows?, pageNo? })**
   상표 출원인 검색. 상표명, 출원/공개/등록 번호·일자, 출원상태, 상품분류코드(NICE), 상표권자명 반환.
4. **search_all_ip({ applicant, numOfRows? })**
   3개 서비스를 병렬 호출해 건수 요약 + 상세목록을 한 번에 반환. M&A 대상기업·경쟁사의
   IP 포트폴리오를 종합적으로 훑어볼 때 사용.

### kipo-api 계열 (2026-09-02 추가)

5. **search_patents_advanced({ inventors?, applicant?, rightHoler?, inventionTitle?, astrtCont?, claimScope?, ipcNumber?, agent?, 각종 번호·일자, lastvalue?, numOfRows?, pageNo? })**
   특허·실용신안 항목별 검색. **발명자(inventors) 검색이 가능한 유일한 경로**이고,
   **30건 상한이 없어 한 페이지 최대 500건**까지 받는다.
6. **search_patents_keyword({ word, ... })** 특허 자유검색(발명의명칭·초록·청구범위 등 통합).
7. **search_designs_keyword({ articleName, ... })** 디자인 물품명 검색.
8. **search_trademarks_keyword({ searchString, ... })** 상표명 검색.
9. **get_patent_detail({ applicationNumber })** 서지상세 — 발명자 명단·청구항 수·심사관·
   최종처분·IPC 전체·법적상태 이력·초록. 목록 검색에 없는 정보가 여기 있다.
   (발명자 주소는 개인정보라 반환하지 않는다)

## 두 계열의 차이 (2026-09-02 실측)

| | `/openapi/rest/...` (1~4) | `/kipo-api/kipi/...` (5~9) |
|---|---|---|
| 인증 파라미터 | `accessKey` | `ServiceKey` |
| 목록 상한 | **30건 고정** (numOfRows·pageNo 무시) | numOfRows가 실제로 먹음, **1페이지 최대 500건** |
| 총건수 위치 | `items.TotalSearchCount` / `items.totalCount` | `response.count.totalCount` |
| 아이템 태그 | `PatentUtilityInfo`/`DesignInfo`/`TradeMarkInfo` | 전부 `<item>` (필드명도 소문자 시작) |
| 검색어 파라미터 | `applicant`/`applicantName` | 특허 `word`, 디자인 `articleName`, 상표 `searchString` |
| 발명자 검색 | 불가 | `getAdvancedSearch`의 `inventors`로 가능 |

- 디자인·상표의 kipo-api 검색은 **행정상태 플래그가 필수**다(디자인 open/rejection/destroy/
  invalid/abandonment/registration, 상표 application/registration/refused/expiration/
  withdrawal/publication/cancel/abandonment). 하나도 주지 않으면
  `NO_MANDATORY_REQUEST_PARAMETERS_ERROR`가 난다. 서버가 기본값으로 전부 켜서 보낸다.
- rest 계열 `freeSearchInfo`의 `word`에는 KIPRIS 검색식을 넣을 수 있으나
  **`AP=`/`TL=`/`AB=`/`CL=`/`RG=`만 동작하고 `IV=`(발명자)·`AG=`(대리인)는 항상 0건**이다.
  발명자 검색을 검색식으로 우회하려 하지 말 것.
- 디자인의 rest 계열 `freeSearchInfo`는 어떤 파라미터명을 줘도 필수값 오류가 나서 쓰지 않는다
  (kipo-api `getWordSearch` + `articleName`으로 대체).

## 이 서버가 하지 않는 것

- 무료 API 특성상 호출량 제한(디자인/상표는 월 1,000회 한도로 확인됨)이 있을 수 있음 — 서버는
  이를 감지·재시도하지 않고 KIPRIS 응답을 그대로 전달합니다.
- 등록원부, 도면 이미지 파일 다운로드, 해외특허(미국·일본·유럽 등) 검색은 다루지 않습니다
  (필요 시 확장). 출원번호 단건 상세조회는 `get_patent_detail`로 지원합니다.
- 여러 출원인명 후보(오탈자, 상호 변경 이력 등) 매칭·정규화는 하지 않습니다 — 호출자가 정확한
  출원인명을 입력해야 합니다.

## 실사용 검증 이력 (2026-07-25)

- curl로 3개 서비스 모두 실제 accessKey로 라이브 검증 완료. 삼성전자(특허 다건), 포니링크
  (특허 2건 이상, 상표 34건: "SUPEREYE", "포니링크 PonyLink", "PonyLink mobility" 등 포함)로 확인.
  디자인은 포니링크 기준 0건(정상 — 오류 아님)으로 확인.
- 필드 목록은 raw XML 응답을 직접 grep하여 확보 (추정 없음).
- 로컬 Node.js 스모크 테스트를 실제 accessKey로 실행해 `search_patents`/`search_designs`/
  `search_trademarks`/`search_all_ip` 4개 함수 모두 정상 동작 확인 후 배포.

## 도구 추가 검증 이력 (2026-09-02)

실제 accessKey로 라이브 검증한 뒤 배포했습니다.

| 검증 항목 | 결과 |
|---|---|
| `inventors=김기현` 발명자 검색 | 2,997건 — 발명자 검색 실동작 확인 |
| `inventors=김기현` + `applicant=포니링크` | 3건 — AND 교차 동작 확인 |
| `applicant=포니링크`, numOfRows=500 | **63건 전건** (기존 `search_patents`는 같은 조건에서 30건에서 잘림) |
| numOfRows 상한 실측 | 100→100건, 500→500건, 1000→500건 → **상한 500** |
| `lastvalue=R` | 63건 중 등록 26건으로 좁혀짐 |
| 디자인 `articleName=자동차` / 상표 `searchString=SUPEREYE` | 63,717건 / 8건 정상 |
| `get_patent_detail(1020240096145)` | 발명자 4인·청구항 19개·IPC 9개·법적상태 11건 파싱 확인 |
| 없는 출원번호 / 빈 조건 | 오류가 아니라 안내 메시지로 반환되는지 확인 |
