// kipris-mcp / lib/server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  searchPatents,
  searchDesigns,
  searchTrademarks,
  searchAllIp,
} from "./kipris_client.js";

export function buildServer() {
  const server = new McpServer({
    name: "kipris-mcp",
    version: "1.0.0",
  });

  server.tool(
    "search_patents",
    "KIPRIS Plus 특허·실용신안 출원인 검색. 출원인명(회사명/개인명)으로 해당 출원인의 특허/실용신안 출원·등록 현황을 조회합니다. " +
      "응답에 출원번호, 출원일, 발명의명칭, 공개/등록번호·일자, 등록상태(등록/소멸/포기/거절 등), IPC 코드, 초록이 포함됩니다. " +
      "자사·경쟁사·M&A 대상기업의 특허 포트폴리오 확인에 사용하세요.",
    {
      applicant: z.string().describe("출원인명 (회사명 또는 개인명). 예: '포니링크', '삼성전자'"),
      numOfRows: z.number().int().min(1).max(100).default(10).describe("조회 건수 (기본 10, 최대 100)"),
      pageNo: z.number().int().min(1).default(1).describe("페이지 번호 (기본 1)"),
    },
    async ({ applicant, numOfRows, pageNo }) => {
      const result = await searchPatents({ applicant, numOfRows, pageNo });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_designs",
    "KIPRIS Plus 디자인 출원인 검색. 출원인명(회사명/개인명)으로 해당 출원인의 디자인권 출원·등록 현황을 조회합니다. " +
      "응답에 출원번호, 출원일, 물품명(articleName), 공개/등록번호·일자, 출원상태, 디자인번호, 창작자명, 대리인명이 포함됩니다. " +
      "총건수 필드명이 다른 두 서비스와 달리 totalCount(소문자 시작)임에 유의하세요.",
    {
      applicant: z.string().describe("출원인명 (회사명 또는 개인명)"),
      numOfRows: z.number().int().min(1).max(100).default(10).describe("조회 건수 (기본 10, 최대 100)"),
      pageNo: z.number().int().min(1).default(1).describe("페이지 번호 (기본 1)"),
    },
    async ({ applicant, numOfRows, pageNo }) => {
      const result = await searchDesigns({ applicant, numOfRows, pageNo });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_trademarks",
    "KIPRIS Plus 상표 출원인 검색. 출원인명(회사명/개인명)으로 해당 출원인의 상표 출원·등록 현황을 조회합니다. " +
      "응답에 상표명(title), 출원번호, 출원일, 공개/등록번호·일자, 출원상태(등록/소멸/거절 등), 상품분류코드(NICE 코드), " +
      "상표권자명, 대리인명이 포함됩니다. 브랜드/서비스명 보호 현황 확인에 사용하세요.",
    {
      applicant: z.string().describe("출원인명 (회사명 또는 개인명)"),
      numOfRows: z.number().int().min(1).max(100).default(10).describe("조회 건수 (기본 10, 최대 100)"),
      pageNo: z.number().int().min(1).default(1).describe("페이지 번호 (기본 1)"),
    },
    async ({ applicant, numOfRows, pageNo }) => {
      const result = await searchTrademarks({ applicant, numOfRows, pageNo });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_all_ip",
    "KIPRIS Plus 특허·디자인·상표 3개 서비스를 한 번에 병렬 조회합니다. " +
      "출원인명 하나로 해당 기업/개인의 전체 지식재산권 현황(특허/실용신안 건수, 디자인 건수, 상표 건수와 각 상세목록)을 " +
      "한 번의 호출로 요약 받고 싶을 때 사용하세요. M&A 대상기업이나 경쟁사의 IP 포트폴리오를 종합적으로 훑어볼 때 유용합니다.",
    {
      applicant: z.string().describe("출원인명 (회사명 또는 개인명)"),
      numOfRows: z.number().int().min(1).max(50).default(10).describe("서비스별 조회 건수 (기본 10, 최대 50)"),
    },
    async ({ applicant, numOfRows }) => {
      const result = await searchAllIp({ applicant, numOfRows });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
