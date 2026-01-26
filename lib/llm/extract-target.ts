import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * LLM 추출된 신청대상 구조
 */
export interface ApplicationTarget {
  // 사업자 유형
  businessStatus: string[];  // ["예비창업자", "개인사업자", "법인"] 등

  // 산업 분류 (한국표준산업분류 기준)
  industryCode: string[];    // ["J", "C"] 등 대분류 코드
  industryKeywords: string[]; // ["반도체", "팹리스", "AI"] 등 키워드

  // 규모 조건
  employeeRange?: string;    // "50명 이하", "10명 이상" 등
  revenueRange?: string;     // "10억 이하", "매출 무관" 등

  // 특수 조건
  specialConditions: string[];  // ["여성창업자", "장애인기업", "사회적기업"] 등
  excludeConditions: string[];  // ["대기업", "상장기업", "외국법인"] 등

  // 기타
  otherConditions?: string;  // 기타 조건 텍스트
}

/**
 * 한국표준산업분류 대분류 코드
 */
const KSIC_CODES: Record<string, string> = {
  'A': '농업, 임업 및 어업',
  'B': '광업',
  'C': '제조업',
  'D': '전기, 가스, 증기 및 공기 조절 공급업',
  'E': '수도, 하수 및 폐기물 처리, 원료 재생업',
  'F': '건설업',
  'G': '도매 및 소매업',
  'H': '운수 및 창고업',
  'I': '숙박 및 음식점업',
  'J': '정보통신업',
  'K': '금융 및 보험업',
  'L': '부동산업',
  'M': '전문, 과학 및 기술 서비스업',
  'N': '사업시설 관리, 사업 지원 및 임대 서비스업',
  'O': '공공 행정, 국방 및 사회보장 행정',
  'P': '교육 서비스업',
  'Q': '보건업 및 사회복지 서비스업',
  'R': '예술, 스포츠 및 여가관련 서비스업',
  'S': '협회 및 단체, 수리 및 기타 개인 서비스업',
};

const EXTRACTION_PROMPT = `당신은 정부 지원사업 공고의 신청대상을 분석하는 전문가입니다.

아래 문서에서 신청대상 조건을 추출하여 JSON 형식으로 반환해주세요.

## 추출 필드:
1. businessStatus: 사업자 유형 배열 (예: ["예비창업자", "개인사업자", "법인", "소상공인", "중소기업", "벤처기업"])
2. industryCode: 한국표준산업분류 대분류 코드 배열 (A~S). 해당되는 산업이 명시되어 있으면 코드로 변환.
   - 예: IT/소프트웨어 → "J", 제조업 → "C", 바이오/의료 → "M" 또는 "C"
3. industryKeywords: 산업 관련 키워드 배열 (예: ["반도체", "팹리스", "AI", "바이오"])
4. employeeRange: 종업원 수 조건 (예: "50명 이하", "10명 이상 300명 미만")
5. revenueRange: 매출 조건 (예: "10억 이하", "100억 미만")
6. specialConditions: 특수 우대 조건 배열 (예: ["여성창업자", "장애인기업", "사회적기업", "청년창업"])
7. excludeConditions: **지원 제외 대상** 배열 - 다음 표현들을 주의 깊게 찾아주세요:
   - "지원제외", "제외대상", "신청불가", "신청 제외", "다음에 해당하는 자는 제외"
   - "대상에서 제외", "지원 대상에서 제외", "보증 제외", "융자 제외"
   - "휴·폐업", "세금체납", "신용불량", "연체", "부도", "회생/파산"
   - "대기업", "상장기업", "금융업", "부동산업", "유흥업" 등 업종 제한
   - (예: ["휴·폐업 중인 기업", "세금 체납자", "신용관리대상자", "금융업종"])
8. otherConditions: 위 카테고리에 속하지 않는 기타 조건 텍스트

## 규칙:
- 문서 전체를 꼼꼼히 읽고, 특히 "제외", "불가", "해당하지 않는" 등의 표현을 찾아 excludeConditions에 반드시 포함
- 조건이 없으면 빈 배열 [] 또는 null 반환
- "제한없음", "무관" 등은 해당 필드를 비움
- JSON만 반환, 다른 텍스트 없음

## 입력 텍스트:
`;

/**
 * eligibility 텍스트에서 신청대상 추출 (Text)
 */
export async function extractApplicationTarget(
  eligibilityText: string,
  descriptionText?: string
): Promise<ApplicationTarget | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[LLM] GEMINI_API_KEY not configured');
    return null;
  }

  if (!eligibilityText && !descriptionText) {
    return null;
  }

  const inputText = [eligibilityText, descriptionText].filter(Boolean).join('\n\n---\n\n');

  try {
    // text-only extraction using flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: EXTRACTION_PROMPT + inputText }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const response = result.response;
    const text = response.text();
    return parseLlmResponse(text);
  } catch (error) {
    console.error('[LLM] Text extraction failed:', error);
    return null;
  }
}

/**
 * 이미지(들)에서 신청대상 추출 (Vision)
 * @param images Base64 이미지 문자열 배열 또는 단일 문자열
 * @param mimeType 이미지 타입 (기본: image/jpeg)
 */
export async function extractTargetFromImage(
  images: string | string[],
  mimeType: string = 'image/jpeg'
): Promise<ApplicationTarget | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[LLM] GEMINI_API_KEY not configured');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imageList = Array.isArray(images) ? images : [images];
    const imageParts = imageList.map(img => ({
      inlineData: {
        data: img,
        mimeType,
      },
    }));

    // 타임아웃 래퍼: Vision AI가 너무 오래 걸리면 중단 (90초)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Vision AI request timed out')), 90000)
    );

    const generatePromise = model.generateContent([
      EXTRACTION_PROMPT + '\n(여러 장의 이미지로 된 공고문일 수 있습니다. 전체 내용을 통합하여 분석해주세요.)',
      ...imageParts,
    ]);

    const result: any = await Promise.race([generatePromise, timeoutPromise]);

    const response = await result.response;
    const text = response.text();

    return parseLlmResponse(text);
  } catch (error) {
    console.error('Vision AI extraction error:', error);
    return null;
  }
}

function parseLlmResponse(text: string): ApplicationTarget {
  try {
    const parsed = JSON.parse(text) as ApplicationTarget;
    return {
      businessStatus: parsed.businessStatus || [],
      industryCode: parsed.industryCode || [],
      industryKeywords: parsed.industryKeywords || [],
      employeeRange: parsed.employeeRange || undefined,
      revenueRange: parsed.revenueRange || undefined,
      specialConditions: parsed.specialConditions || [],
      excludeConditions: parsed.excludeConditions || [],
      otherConditions: parsed.otherConditions || undefined,
    };
  } catch (e) {
    console.error('JSON Parse Error:', e);
    return {
      businessStatus: [],
      industryCode: [],
      industryKeywords: [],
      specialConditions: [],
      excludeConditions: []
    };
  }
}

/**
 * 배치 처리: 미처리 공고들의 신청대상 추출
 */
export async function processUnprocessedPrograms(
  programs: Array<{ id: string; eligibility: string | null; description: string | null }>
): Promise<Map<string, ApplicationTarget | null>> {
  const results = new Map<string, ApplicationTarget | null>();

  for (const program of programs) {
    console.log(`[LLM] Processing program ${program.id}...`);

    const target = await extractApplicationTarget(
      program.eligibility || '',
      program.description || ''
    );

    results.set(program.id, target);

    // Rate limiting: 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
