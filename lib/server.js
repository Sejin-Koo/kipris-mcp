// kipris-mcp / lib/server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  searchPatents,
  searchDesigns,
  searchTrademarks,
  searchAllIp,
  searchPatentsAdvanced,
  searchPatentsWord,
  searchDesignsWord,
  searchTrademarksWord,
  getPatentDetail,
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


  server.tool(
    "search_patents_advanced",
    "KIPRIS Plus 특허·실용신안 항목별 검색. ★ 발명자(inventors) 검색이 가능한 유일한 도구이며, " +
      "search_patents(출원인 검색)와 달리 목록이 30건에서 잘리지 않고 한 페이지 최대 500건까지 받을 수 있습니다. " +
      "발명자·출원인·발명의명칭·초록·청구범위·IPC·권리자·각종 번호와 일자를 조건으로 주면 AND로 좁혀집니다. " +
      "특정 인물이 참여한 특허를 찾거나, 출원인의 전체 특허 목록(30건 초과)이 필요할 때 이 도구를 쓰세요.",
    {
      inventors: z.string().optional().describe("발명자명. 예: '김기현'. 발명자 검색은 이 파라미터로만 가능합니다"),
      applicant: z.string().optional().describe("출원인명(회사명/개인명)"),
      rightHoler: z.string().optional().describe("권리자(등록권자)명 — 출원 후 양수한 현재 권리자 기준. 철자 그대로 rightHoler(l 하나)입니다"),
      inventionTitle: z.string().optional().describe("발명의 명칭에 포함된 키워드"),
      astrtCont: z.string().optional().describe("초록(요약)에 포함된 키워드"),
      claimScope: z.string().optional().describe("청구범위에 포함된 키워드"),
      ipcNumber: z.string().optional().describe("IPC 분류코드. 예: 'G06N'"),
      agent: z.string().optional().describe("대리인(특허사무소·변리사)명"),
      applicationNumber: z.string().optional().describe("출원번호 (하이픈 없이)"),
      openNumber: z.string().optional().describe("공개번호"),
      publicationNumber: z.string().optional().describe("공고번호"),
      registerNumber: z.string().optional().describe("등록번호"),
      applicationDate: z.string().optional().describe("출원일 (YYYYMMDD, 또는 'YYYYMMDD~YYYYMMDD' 범위)"),
      registerDate: z.string().optional().describe("등록일 (YYYYMMDD)"),
      lastvalue: z.string().optional().describe("등록상태 제한 (A=공개, C=정정공고, F=소멸, G=포기, I=무효, J=취하, R=등록. 빈값=전체)"),
      patent: z.boolean().default(true).describe("특허 포함 (기본 true)"),
      utility: z.boolean().default(true).describe("실용신안 포함 (기본 true)"),
      sortSpec: z.string().default("AD").describe("정렬 기준 (AD=출원일, OPD=공개일, PD=공고일, GD=등록일)"),
      descSort: z.boolean().default(true).describe("내림차순(최신순) 정렬. 기본 true"),
      numOfRows: z.number().int().min(1).max(500).default(20).describe("조회 건수. 한 페이지 최대 500 (실측 상한)"),
      pageNo: z.number().int().min(1).default(1).describe("페이지 번호"),
    },
    async (args) => {
      const result = await searchPatentsAdvanced(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_patents_keyword",
    "KIPRIS Plus 특허·실용신안 자유검색. 발명의명칭·초록·청구범위 등을 한 번에 훑어 기술 키워드로 특허를 찾습니다. " +
      "출원인을 모른 채 '자율주행 관련 최근 특허'처럼 주제로 찾을 때 쓰세요. 항목을 지정해 좁히려면 search_patents_advanced를 쓰세요. " +
      "목록은 한 페이지 최대 500건까지 받을 수 있습니다.",
    {
      word: z.string().describe("자유검색어. 예: '자율주행 라이다'"),
      patent: z.boolean().default(true).describe("특허 포함 (기본 true)"),
      utility: z.boolean().default(true).describe("실용신안 포함 (기본 true)"),
      lastvalue: z.string().optional().describe("등록상태 제한 (R=등록, A=공개, F=소멸 등. 빈값=전체)"),
      sortSpec: z.string().default("AD").describe("정렬 기준 (AD=출원일 등)"),
      descSort: z.boolean().default(true).describe("내림차순(최신순). 기본 true"),
      numOfRows: z.number().int().min(1).max(500).default(20).describe("조회 건수. 최대 500"),
      pageNo: z.number().int().min(1).default(1).describe("페이지 번호"),
    },
    async (args) => {
      const result = await searchPatentsWord(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_designs_keyword",
    "KIPRIS Plus 디자인 물품명 검색. 출원인을 모른 채 물품 종류로 디자인권을 찾을 때 사용합니다. " +
      "★ 이 서비스는 검색어 파라미터가 word가 아니라 articleName(물품명)입니다. 출원인명을 아는 경우에는 search_designs를 쓰세요.",
    {
      articleName: z.string().describe("물품명 검색어. 예: '자동차 보호필름'"),
      numOfRows: z.number().int().min(1).max(500).default(20).describe("조회 건수. 최대 500"),
      pageNo: z.number().int().min(1).default(1).describe("페이지 번호"),
    },
    async (args) => {
      const result = await searchDesignsWord(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_trademarks_keyword",
    "KIPRIS Plus 상표명 검색. 특정 브랜드·서비스명이 이미 출원·등록돼 있는지, 누가 보유하는지 확인할 때 사용합니다. " +
      "★ 검색어 파라미터명이 searchString입니다. 출원인명을 아는 경우에는 search_trademarks를 쓰세요.",
    {
      searchString: z.string().describe("상표명·브랜드명 검색어. 예: 'SUPEREYE'"),
      numOfRows: z.number().int().min(1).max(500).default(20).describe("조회 건수. 최대 500"),
      pageNo: z.number().int().min(1).default(1).describe("페이지 번호"),
    },
    async (args) => {
      const result = await searchTrademarksWord(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_patent_detail",
    "KIPRIS Plus 특허·실용신안 서지상세 조회. 출원번호 하나로 목록 검색에는 없는 정보를 받습니다 — " +
      "발명자 명단, 출원인·대리인, 청구항 수, 심사관, 최종처분, IPC 전체, 법적상태 이력(출원~등록까지의 서류 접수 경과), 초록. " +
      "다른 검색 결과에서 얻은 출원번호의 발명자나 심사 경과를 확인할 때 사용하세요. (발명자 주소는 반환하지 않습니다)",
    {
      applicationNumber: z.string().describe("출원번호 (하이픈 없이 숫자만. 예: 1020240096145)"),
    },
    async ({ applicationNumber }) => {
      const result = await getPatentDetail({ applicationNumber });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
