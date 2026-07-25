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
  isArray: (name) => ["PatentUtilityInfo", "DesignInfo", "TradeMarkInfo"].includes(name),
});

function qs(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function rawFetch(url) {
  const res = await fetch(url, { method: "GET", headers: { "User-Agent": UA } });
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buf);
  return { status: res.status, text };
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
