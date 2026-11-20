// kipris-mcp / lib/kipris_client.js
//
// KIPRIS Plus 특허·실용신안 / 디자인 / 상표 3개 서비스는 같은 accessKey를 쓰지만
// 오퍼레이션명과 출원인 파라미터명이 서비스마다 미묘하게 다릅니다:
//   - 특허(patUtiModInfoSearchSevice): applicantNameSearchInfo, 파라미터명 applicant
//   - 디자인(designInfoSearchService): applicantNameSearchInfo, 파라미터명 applicantName
//   - 상표(trademarkInfoSearchService): applicantNamesearchInfo(소문자 s), 파라미터명 applicantName
// 이 모듈은 이 차이를 흡수하고, 응답 필드명도 서비스마다 다른(대문자 시작/소문자 시작 등)
// 부분을 공통 스키마로 정규화해서 반환합니다.

import { XMLParser } from "fast-xml-parser";

export const ACCESS_KEY = process.env.KIPRIS_ACCESS_KEY || "";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// PatentUtilityInfo/DesignInfo/TradeMarkInfo는 결과가 1건일 때 배열이 아니라 단일 객체로
// 파싱될 수 있으므로, 이 태그들은 항상 배열로 강제한다.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  // resultCode가 "00"처럼 숫자로 보이는 문자열이라 parseTagValue 기본값(true)이면
  // 0으로 파싱되어 "00" 비교가 항상 실패한다 (public-data-portal-mcp에서 발견한 것과 동일한 버그 클래스).
  parseTagValue: false,
  isArray: (name) =>
    ["PatentUtilityInfo", "DesignInfo", "TradeMarkInfo", "item", "inventorInfo", "applicantInfo", "agentInfo", "ipcInfo", "legalStatusInfo"].includes(name),
});

function qs(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// 연결 단계 실패(fetch failed — 접속 끊김·거부·DNS 등)는 잠깐 쉬고 최대 3회까지 받는다.
// 2026-11-17 11:29 실측: 특허 상세가 'fetch failed'로 실패했다가 같은 출원번호 재호출은 정상(같은 2분 사이 다른
// 기관 API도 함께 실패한 원천·망 일시 장애). 전에는 시간 제한도 재시도도 없어 바로 오류였다.
// 응답 시간 초과(시도당 20초)는 다시 받지 않는다 — 함수 한도(30초)를 넘길 수 있다.
const TRIES = 3;
const ATTEMPT_MS = 20000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rawFetch(url) {
  let last;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ATTEMPT_MS);
    try {
      const res = await fetch(url, { method: "GET", headers: { "User-Agent": UA }, signal: ac.signal });
      const buf = await res.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buf);
      if (res.status >= 500 && attempt < TRIES - 1) { last = new Error(`KIPRIS 서버 오류 HTTP ${res.status}`); await sleep(600 * (attempt + 1)); continue; }
      return { status: res.status, text };
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`KIPRIS 응답이 ${ATTEMPT_MS / 1000}초 안에 오지 않았습니다 — 잠시 후 다시 조회하세요.`);
      const code = e.cause && (e.cause.code || e.cause.message);
      last = new Error(`KIPRIS 연결 실패: ${e.message}${code ? ` (${code})` : ""}`);
      if (attempt < TRIES - 1) { await sleep(600 * (attempt + 1)); continue; }
    } finally {
      clearTimeout(timer);
    }
  }
  last.message += ` (${TRIES}회 시도 — 연결 장애로 보입니다. 잠시 후 다시 조회하세요)`;
  throw last;
}

function parseXml(text) {
  try {
    return { data: xmlParser.parse(text), error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------------------------------------------------------------------------
// 1) 특허/실용신안
// ---------------------------------------------------------------------------

export async function searchPatents({ applicant, numOfRows = 10, pageNo = 1 }) {
  const url =
    "http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/applicantNameSearchInfo?" +
    qs({ applicant, accessKey: ACCESS_KEY, numOfRows, pageNo });
  const { status, text } = await rawFetch(url);
  const { data, error } = parseXml(text);
  if (error) return { error: `parse error: ${error}`, httpStatus: status };

  const resultCode = data?.response?.header?.resultCode;
  if (resultCode !== "00") {
    return {
      error: `resultCode=${resultCode} resultMsg=${data?.response?.header?.resultMsg}`,
      httpStatus: status,
    };
  }

  const items = asArray(data?.response?.body?.items?.PatentUtilityInfo);
  const totalCount = Number(data?.response?.body?.items?.TotalSearchCount ?? items.length);

  return {
    totalCount,
    items: items.map((it) => ({
      type: "patent",
      title: it.InventionName,
      applicant: it.Applicant,
      applicationNumber: it.ApplicationNumber,
      applicationDate: it.ApplicationDate,
      publicNumber: it.PublicNumber || null,
      publicDate: it.PublicDate || null,
      openingNumber: it.OpeningNumber || null,
      openingDate: it.OpeningDate || null,
      registrationNumber: it.RegistrationNumber || null,
      registrationDate: it.RegistrationDate || null,
      status: it.RegistrationStatus,
      abstract: it.Abstract || null,
      ipcCode: it.InternationalpatentclassificationNumber || null,
    })),
  };
}

// ---------------------------------------------------------------------------
// 2) 디자인
// ---------------------------------------------------------------------------

export async function searchDesigns({ applicant, numOfRows = 10, pageNo = 1 }) {
  const url =
    "http://plus.kipris.or.kr/openapi/rest/designInfoSearchService/applicantNameSearchInfo?" +
    qs({ applicantName: applicant, accessKey: ACCESS_KEY, numOfRows, pageNo });
  const { status, text } = await rawFetch(url);
  const { data, error } = parseXml(text);
  if (error) return { error: `parse error: ${error}`, httpStatus: status };

  const resultCode = data?.response?.header?.resultCode;
  if (resultCode !== "00") {
    return {
      error: `resultCode=${resultCode} resultMsg=${data?.response?.header?.resultMsg}`,
      httpStatus: status,
    };
  }

  const items = asArray(data?.response?.body?.items?.DesignInfo);
  const totalCount = Number(data?.response?.body?.items?.totalCount ?? items.length);

  return {
    totalCount,
    items: items.map((it) => ({
      type: "design",
      title: it.articleName,
      applicant: it.applicantName,
      applicationNumber: it.applicationNumber,
      applicationDate: it.applicationDate,
      publicationNumber: it.publicationNumber || null,
      publicationDate: it.publicationDate || null,
      registrationNumber: it.registrationNumber || null,
      registrationDate: it.registrationDate || null,
      status: it.applicationStatus,
      designNumber: it.designNumber || null,
      inventorName: it.inventorName || null,
      agentName: it.agentName || null,
    })),
  };
}

// ---------------------------------------------------------------------------
// 3) 상표
// ---------------------------------------------------------------------------

export async function searchTrademarks({ applicant, numOfRows = 10, pageNo = 1 }) {
  // ★ 오퍼레이션명이 applicantNamesearchInfo — Name 뒤 search가 소문자 s (특허/디자인과 다름).
  const url =
    "http://plus.kipris.or.kr/openapi/rest/trademarkInfoSearchService/applicantNamesearchInfo?" +
    qs({ applicantName: applicant, accessKey: ACCESS_KEY, numOfRows, pageNo });
  const { status, text } = await rawFetch(url);
  const { data, error } = parseXml(text);
  if (error) return { error: `parse error: ${error}`, httpStatus: status };

  const resultCode = data?.response?.header?.resultCode;
  if (resultCode !== "00") {
    return {
      error: `resultCode=${resultCode} resultMsg=${data?.response?.header?.resultMsg}`,
      httpStatus: status,
    };
  }

  const items = asArray(data?.response?.body?.items?.TradeMarkInfo);
  const totalCount = Number(data?.response?.body?.items?.TotalSearchCount ?? items.length);

  return {
    totalCount,
    items: items.map((it) => ({
      type: "trademark",
      title: it.Title,
      applicant: it.ApplicantName,
      applicationNumber: it.ApplicationNumber,
      applicationDate: it.ApplicationDate,
      publicNumber: it.PublicNumber || null,
      publicDate: it.PublicDate || null,
      registrationNumber: it.RegistrationNumber || null,
      registrationDate: it.RegistrationDate || null,
      status: it.ApplicationStatus,
      goodClassificationCode: it.GoodClassificationCode || null,
      rightholderName: it.RegistrationRightholderName || null,
      agentName: it.AgentName || null,
    })),
  };
}

// ---------------------------------------------------------------------------
// 4) 통합 조회 (3개 서비스 병렬 호출 + 요약)
// ---------------------------------------------------------------------------

export async function searchAllIp({ applicant, numOfRows = 10 }) {
  const [patents, designs, trademarks] = await Promise.all([
    searchPatents({ applicant, numOfRows }),
    searchDesigns({ applicant, numOfRows }),
    searchTrademarks({ applicant, numOfRows }),
  ]);

  return {
    applicant,
    summary: {
      patentTotalCount: patents.error ? null : patents.totalCount,
      designTotalCount: designs.error ? null : designs.totalCount,
      trademarkTotalCount: trademarks.error ? null : trademarks.totalCount,
    },
    patents,
    designs,
    trademarks,
  };
}

// ---------------------------------------------------------------------------
// 5) kipo-api 계열 — 키워드검색·항목검색(발명자 포함)·서지상세
// ---------------------------------------------------------------------------
//
// 위 1~4는 `/openapi/rest/...` + `accessKey` 경로다. 아래는 같은 KIPRIS Plus이지만
// **경로와 인증 파라미터명이 다른** `/kipo-api/kipi/...` + `ServiceKey` 계열이며,
// 실측(2026-09-02) 결과 다음이 다르다.
//
//   - 상세목록 상한: rest 계열은 파라미터와 무관하게 30건에서 잘리지만,
//     kipo-api 계열은 numOfRows가 실제로 먹고 **한 페이지 최대 500건**이다.
//   - 총건수 위치: rest 계열은 items.TotalSearchCount / items.totalCount,
//     kipo-api 계열은 response.count.totalCount.
//   - 아이템 태그: rest 계열은 PatentUtilityInfo/DesignInfo/TradeMarkInfo,
//     kipo-api 계열은 전부 <item>. 필드명도 소문자 시작 camelCase다.
//   - 발명자 검색은 kipo-api getAdvancedSearch의 `inventors` 파라미터로만 된다.
//     rest 계열 freeSearchInfo의 word에 KIPRIS 검색식 IV=[…]를 넣어도 항상 0건이다
//     (AP=/TL=/AB=/CL=/RG=는 동작하지만 IV=·AG=는 색인되지 않음 — 실측 확인).
//   - 검색어 파라미터명이 서비스마다 다르다: 특허 word, 디자인 articleName, 상표 searchString.
//   - 디자인·상표 검색은 행정상태 플래그가 **필수**라 하나도 주지 않으면
//     NO_MANDATORY_REQUEST_PARAMETERS_ERROR가 난다.

const KIPO_BASE = "http://plus.kipris.or.kr/kipo-api/kipi";

// 디자인·상표 검색의 필수 행정상태 플래그 (기본값: 전체 포함)
const DESIGN_STATUS_FLAGS = {
  open: "true",
  rejection: "true",
  destroy: "true",
  invalid: "true",
  abandonment: "true",
  registration: "true",
};
const TRADEMARK_STATUS_FLAGS = {
  application: "true",
  registration: "true",
  refused: "true",
  expiration: "true",
  withdrawal: "true",
  publication: "true",
  cancel: "true",
  abandonment: "true",
};

function pickField(it, ...names) {
  for (const n of names) {
    const v = it?.[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function normalizeKipoItem(it, type) {
  return {
    type,
    title: pickField(it, "inventionTitle", "articleName", "title"),
    applicant: pickField(it, "applicantName"),
    applicationNumber: pickField(it, "applicationNumber"),
    applicationDate: pickField(it, "applicationDate"),
    openNumber: pickField(it, "openNumber"),
    openDate: pickField(it, "openDate"),
    publicationNumber: pickField(it, "publicationNumber"),
    publicationDate: pickField(it, "publicationDate"),
    registrationNumber: pickField(it, "registerNumber", "registrationNumber"),
    registrationDate: pickField(it, "registerDate", "registrationDate"),
    status: pickField(it, "registerStatus", "applicationStatus"),
    ipcCode: pickField(it, "ipcNumber"),
    classificationCode: pickField(it, "classificationCode"),
    agentName: pickField(it, "agentName"),
    abstract: pickField(it, "astrtCont"),
  };
}

async function callKipo({ path, params, type }) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  }
  const url = `${KIPO_BASE}${path}?` + qs({ ...clean, ServiceKey: ACCESS_KEY });
  const { status, text } = await rawFetch(url);
  const { data, error } = parseXml(text);
  if (error) return { error: `parse error: ${error}`, httpStatus: status };

  const resultCode = data?.response?.header?.resultCode;
  if (resultCode !== "00") {
    return {
      error: `resultCode=${resultCode} resultMsg=${data?.response?.header?.resultMsg}`,
      httpStatus: status,
      hint:
        resultCode === "11"
          ? "필수 파라미터 누락 — 검색어 파라미터명이 서비스마다 다릅니다(특허 word / 디자인 articleName / 상표 searchString)."
          : undefined,
    };
  }

  const items = asArray(data?.response?.body?.items?.item);
  const totalCount = Number(data?.response?.count?.totalCount ?? items.length);
  const requested = Number(params.numOfRows ?? items.length);
  return {
    totalCount,
    returnedCount: items.length,
    // 이 페이지가 전부인지 여부를 호출자가 바로 알 수 있게 표시한다.
    truncated: totalCount > items.length,
    note:
      totalCount > items.length
        ? `총 ${totalCount}건 중 ${items.length}건만 반환됨. numOfRows(최대 500)와 pageNo로 나머지를 받으세요.`
        : undefined,
    items: items.map((it) => normalizeKipoItem(it, type)),
  };
}

const ADVANCED_PARAMS = [
  "inventionTitle",
  "astrtCont",
  "claimScope",
  "ipcNumber",
  "applicationNumber",
  "openNumber",
  "publicationNumber",
  "registerNumber",
  "applicant",
  "inventors",
  "agent",
  "rightHoler",
  "applicationDate",
  "openDate",
  "publicationDate",
  "registerDate",
];

/**
 * 특허·실용신안 항목별 검색 (kipo-api getAdvancedSearch).
 * 발명자(inventors) 검색이 가능한 유일한 경로이며, 목록이 30건에서 잘리지 않는다.
 */
export async function searchPatentsAdvanced(args = {}) {
  const params = {
    patent: args.patent === false ? "false" : "true",
    utility: args.utility === false ? "false" : "true",
    lastvalue: args.lastvalue || "",
    numOfRows: Math.min(Number(args.numOfRows) || 20, 500),
    pageNo: Number(args.pageNo) || 1,
    sortSpec: args.sortSpec || "AD",
    descSort: args.descSort === false ? "false" : "true",
  };
  let given = 0;
  for (const k of ADVANCED_PARAMS) {
    if (args[k] !== undefined && args[k] !== null && args[k] !== "") {
      params[k] = args[k];
      given += 1;
    }
  }
  if (given === 0) {
    return {
      error:
        "검색 조건이 없습니다. inventors(발명자)·applicant(출원인)·inventionTitle(발명의명칭)·astrtCont(초록)·claimScope(청구범위)·ipcNumber 중 최소 하나를 지정하세요.",
    };
  }
  return callKipo({ path: "/patUtiModInfoSearchSevice/getAdvancedSearch", params, type: "patent" });
}

/** 특허·실용신안 자유검색 (kipo-api getWordSearch) — 발명의명칭·초록·청구범위 등을 한 번에 훑는다. */
export async function searchPatentsWord({
  word,
  patent = true,
  utility = true,
  lastvalue = "",
  numOfRows = 20,
  pageNo = 1,
  sortSpec = "AD",
  descSort = true,
}) {
  if (!word) return { error: "word(검색어)가 필요합니다." };
  return callKipo({
    path: "/patUtiModInfoSearchSevice/getWordSearch",
    params: {
      word,
      patent: patent ? "true" : "false",
      utility: utility ? "true" : "false",
      lastvalue,
      numOfRows: Math.min(Number(numOfRows) || 20, 500),
      pageNo,
      sortSpec,
      descSort: descSort ? "true" : "false",
    },
    type: "patent",
  });
}

/** 디자인 검색 (kipo-api getWordSearch) — 검색어 파라미터명이 articleName(물품명)이다. */
export async function searchDesignsWord({ articleName, numOfRows = 20, pageNo = 1 }) {
  if (!articleName) return { error: "articleName(물품명 검색어)이 필요합니다." };
  return callKipo({
    path: "/designInfoSearchService/getWordSearch",
    params: {
      articleName,
      ...DESIGN_STATUS_FLAGS,
      numOfRows: Math.min(Number(numOfRows) || 20, 500),
      pageNo,
    },
    type: "design",
  });
}

/** 상표 검색 (kipo-api getWordSearch) — 검색어 파라미터명이 searchString이다. */
export async function searchTrademarksWord({ searchString, numOfRows = 20, pageNo = 1 }) {
  if (!searchString) return { error: "searchString(상표명 검색어)이 필요합니다." };
  return callKipo({
    path: "/trademarkInfoSearchService/getWordSearch",
    params: {
      searchString,
      ...TRADEMARK_STATUS_FLAGS,
      numOfRows: Math.min(Number(numOfRows) || 20, 500),
      pageNo,
    },
    type: "trademark",
  });
}

/**
 * 특허·실용신안 서지상세 (kipo-api getBibliographyDetailInfoSearch).
 * 목록 검색에는 없는 **발명자 명단·청구항 수·심사관·법적상태 이력·IPC 전체**를 준다.
 * 발명자 주소는 개인정보라 반환하지 않는다.
 */
export async function getPatentDetail({ applicationNumber }) {
  if (!applicationNumber) return { error: "applicationNumber(출원번호)가 필요합니다." };
  const url =
    `${KIPO_BASE}/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch?` +
    qs({ applicationNumber, ServiceKey: ACCESS_KEY });
  const { status, text } = await rawFetch(url);
  const { data, error } = parseXml(text);
  if (error) return { error: `parse error: ${error}`, httpStatus: status };

  const resultCode = data?.response?.header?.resultCode;
  if (resultCode !== "00") {
    return {
      error: `resultCode=${resultCode} resultMsg=${data?.response?.header?.resultMsg}`,
      httpStatus: status,
    };
  }

  // 파서가 <item>을 항상 배열로 만들므로 상세조회에서는 첫 요소를 꺼낸다.
  const item = asArray(data?.response?.body?.item).find((x) => x && typeof x === "object");
  if (!item) return { error: "해당 출원번호로 조회된 건이 없습니다.", applicationNumber };

  const bib = asArray(item?.biblioSummaryInfoArray?.biblioSummaryInfo).find((x) => x && typeof x === "object") || {};
  if (!pickField(bib, "applicationNumber")) {
    return { error: "해당 출원번호로 조회된 건이 없습니다.", applicationNumber };
  }
  const names = (node, key) =>
    asArray(node).map((x) => ({ name: pickField(x, "name"), engName: pickField(x, "engName") }));

  return {
    applicationNumber: pickField(bib, "applicationNumber") || applicationNumber,
    inventionTitle: pickField(bib, "inventionTitle"),
    inventionTitleEng: pickField(bib, "inventionTitleEng"),
    applicationDate: pickField(bib, "applicationDate"),
    openNumber: pickField(bib, "openNumber"),
    openDate: pickField(bib, "openDate"),
    publicationNumber: pickField(bib, "publicationNumber"),
    publicationDate: pickField(bib, "publicationDate"),
    registerNumber: pickField(bib, "registerNumber"),
    registerDate: pickField(bib, "registerDate"),
    registerStatus: pickField(bib, "registerStatus"),
    finalDisposal: pickField(bib, "finalDisposal"),
    claimCount: pickField(bib, "claimCount"),
    examinerName: pickField(bib, "examinerName"),
    originalApplicationKind: pickField(bib, "originalApplicationKind"),
    applicants: names(item?.applicantInfoArray?.applicantInfo),
    inventors: names(item?.inventorInfoArray?.inventorInfo),
    agents: names(item?.agentInfoArray?.agentInfo),
    ipc: asArray(item?.ipcInfoArray?.ipcInfo).map((x) => ({
      code: pickField(x, "ipcNumber"),
      date: pickField(x, "ipcDate"),
    })),
    legalStatus: asArray(item?.legalStatusInfoArray?.legalStatusInfo).map((x) => ({
      document: pickField(x, "documentName"),
      result: pickField(x, "commonCodeName"),
      date: pickField(x, "receiptDate"),
    })),
    abstract: pickField(asArray(item?.abstractInfoArray?.abstractInfo)[0] || {}, "astrtCont"),
  };
}
