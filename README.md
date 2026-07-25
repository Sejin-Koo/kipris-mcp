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
KIPRIS_ACCESS_KEY=1pTo3VrKvlLnwG17pUqfB0YSe1J4s657czMPaREoT3w=
```

## 제공 도구 (4개)

1. **search_patents({ applicant, numOfRows?, pageNo? })**
   특허/실용신안 출원인 검색. 발명의명칭, 출원/공개/등록 번호·일자, 등록상태, IPC코드, 초록 반환.
2. **search_designs({ applicant, numOfRows?, pageNo? })**
   디자인 출원인 검색. 물품명, 출원/공개/등록 번호·일자, 출원상태, 디자인번호, 창작자명 반환.
3. **search_trademarks({ applicant, numOfRows?, pageNo? })**
   상표 출원인 검색. 상표명, 출원/공개/등록 번호·일자, 출원상태, 상품분류코드(NICE), 상표권자명 반환.
4. **search_all_ip({ applicant, numOfRows? })**
   3개 서비스를 병렬 호출해 건수 요약 + 상세목록을 한 번에 반환. M&A 대상기업·경쟁사의
   IP 포트폴리오를 종합적으로 훑어볼 때 사용.

## 이 서버가 하지 않는 것

- 무료 API 특성상 호출량 제한(디자인/상표는 월 1,000회 한도로 확인됨)이 있을 수 있음 — 서버는
  이를 감지·재시도하지 않고 KIPRIS 응답을 그대로 전달합니다.
- 출원번호 단건 상세조회, 등록원부, 심사진행상태 등 KIPRIS Plus의 다른 세부 API는 다루지 않습니다
  (필요 시 확장).
- 여러 출원인명 후보(오탈자, 상호 변경 이력 등) 매칭·정규화는 하지 않습니다 — 호출자가 정확한
  출원인명을 입력해야 합니다.

## 실사용 검증 이력 (2026-07-25)

- curl로 3개 서비스 모두 실제 accessKey로 라이브 검증 완료. 삼성전자(특허 다건), 포니링크
  (특허 2건 이상, 상표 34건: "SUPEREYE", "포니링크 PonyLink", "PonyLink mobility" 등 포함)로 확인.
  디자인은 포니링크 기준 0건(정상 — 오류 아님)으로 확인.
- 필드 목록은 raw XML 응답을 직접 grep하여 확보 (추정 없음).
- 로컬 Node.js 스모크 테스트를 실제 accessKey로 실행해 `search_patents`/`search_designs`/
  `search_trademarks`/`search_all_ip` 4개 함수 모두 정상 동작 확인 후 배포.
