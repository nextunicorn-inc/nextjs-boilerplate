
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * LLM 추출 데이터 구조 (Structured Matching Data)
 */
export interface ApplicationTarget {
  companyAge: string;      // 업력 (예: "7년 미만", "예비창업자")
  targetRegion: string;    // 지역 (예: "서울", "전국")
  targetAge: string;       // 대표자 연령 (예: "만 39세 이하", "무관")
  targetIndustry: string;  // 대상 업종 (예: "SW", "제조업", "관광업")

  // Optional detailed fields for AI summary
  aiSummary?: string;
  targetDetail?: string;
  exclusionDetail?: string;
}

// LLM 프롬프트
const EXTRACTION_PROMPT = `
제공된 창업지원사업 공고문(이미지/텍스트)을 분석하여 핵심 정보를 JSON 형식으로 추출해줘.
다음 4가지 항목을 정확하게 파악하여 값을 채워야 해.

1. **companyAge**: 신청 가능한 **업력(창업기간)** 요건을 명확히 추출.
   - 예: "예비창업자", "3년 미만", "7년 이내", "무관"
   - **중요**: "1년 미만, 3년 미만, 7년 미만" 등 여러 구간이 나열되어 있다면, 이를 모두 포괄하는 **가장 넓은 범위 하나만** 기재할 것. (예: "7년 미만")
2. **targetRegion**: 사업장 소재지 등 **지역 제한**이 있는지 확인.
   - 예: "서울", "경기도", "전국", "제주"
3. **targetAge**: 대표자 **연령 제한**이 있는지 확인.
   - 예: "만 39세 이하", "만 19세~39세", "무관"
   - **중요**: "만 20세~39세, 만 40세 이상" 처럼 사실상 전연령이거나 넓은 범위라면 **"만 20세 이상"** 또는 **"무관"** 등으로 단순화하여 핵심만 기재할 것.
4. **targetIndustry**: 특정 **업종/분야**만 지원한다면 기재.
   - 예: "정보통신업", "제조업", "바이오", "전분야(일반)"

**주의사항**:
- 공고문 이미지 내에 있는 표(Table) 내용을 꼼꼼히 확인해. 자격 요건은 보통 표 안에 있어.
- 값이 명시되지 않았거나 제한이 없어 보이면 "무관", "전국" 등으로 합리적으로 기재해. ("확인불가" X, 빈값 X)
- 내용을 정확히 파악하여 매칭 시스템이 활용할 수 있는 단어로 짧게 요약해줘.
`;

const schema: any = {
  type: SchemaType.OBJECT,
  properties: {
    companyAge: { type: SchemaType.STRING },
    targetRegion: { type: SchemaType.STRING },
    targetAge: { type: SchemaType.STRING },
    targetIndustry: { type: SchemaType.STRING },
  },
  required: ["companyAge", "targetRegion", "targetAge", "targetIndustry"],
};

/**
 * Text Mode Extraction
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
    // Structured output works best with 2.0 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: EXTRACTION_PROMPT + '\n\n[입력 텍스트]\n' + inputText }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    return parseLlmResponse(result.response.text());
  } catch (error) {
    console.error('[LLM] Text extraction failed:', error);
    return null;
  }
}

/**
 * Vision Mode Extraction
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
    // Vision also works with gemini-2.0-flash for structured data
    const model = genAI.getGenerativeModel(
      { model: 'gemini-2.0-flash' },
      { timeout: 300000 } // 5 min timeout
    );

    const imageList = Array.isArray(images) ? images : [images];
    const imageParts = imageList.map(img => ({
      inlineData: {
        data: img,
        mimeType,
      },
    }));

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          ...imageParts,
          { text: EXTRACTION_PROMPT + "\n\n결과를 반드시 JSON으로 출력해." },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    return parseLlmResponse(result.response.text());

  } catch (error) {
    console.error('Vision AI extraction error:', error);
    return null;
  }
}

function parseLlmResponse(text: string): ApplicationTarget {
  try {
    const parsed = JSON.parse(text) as ApplicationTarget;
    return {
      companyAge: parsed.companyAge || '무관',
      targetRegion: parsed.targetRegion || '전국',
      targetAge: parsed.targetAge || '무관',
      targetIndustry: parsed.targetIndustry || '전분야',
      aiSummary: parsed.aiSummary,
      targetDetail: parsed.targetDetail,
      exclusionDetail: parsed.exclusionDetail,
    };
  } catch (e) {
    console.error('JSON Parse Error:', e);
    // Return empty fallback
    return {
      companyAge: '',
      targetRegion: '',
      targetAge: '',
      targetIndustry: '',
    };
  }
}
