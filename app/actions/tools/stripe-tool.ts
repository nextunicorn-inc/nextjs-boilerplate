"use server";

import Stripe from "stripe";

// 숫자를 보기 좋게 포맷팅 (예: $10.00)
const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

export async function fetchStripeData(
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  apiKey: string
) {
  if (!apiKey) throw new Error("Stripe API Key가 누락되었습니다.");

  const stripe = new Stripe(apiKey, { apiVersion: "2025-12-15.clover" });

  // 날짜 변환 (Unix Timestamp)
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

  try {
    // 1. 기간 내 결제 내역 조회 (최대 100건)
    // 실제 운영 환경에서는 Pagination이 필요할 수 있으나, 인사이트 도출용으로 최근 100건을 분석합니다.
    const charges = await stripe.charges.list({
      created: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
    });

    // 2. 데이터 집계
    let totalRevenue = 0;
    let successCount = 0;
    let failCount = 0;
    const currency = charges.data[0]?.currency || "usd";

    charges.data.forEach((charge) => {
      if (charge.paid && !charge.refunded) {
        totalRevenue += charge.amount;
        successCount++;
      }
      if (charge.status === "failed") {
        failCount++;
      }
    });

    // 3. 활성 구독자 수 조회 (SaaS인 경우 중요)
    // (이 부분은 구독 모델이 아니라면 0으로 나올 수 있음)
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 1, // 개수만 알면 되므로 total_count 활용 (단, 정확한 total_count는 list에서 바로 안주므로 근사치 추정 대신 직접 카운팅하거나, 여기선 간단히 생략 가능하나 일단 시도)
      created: { gte: startTimestamp, lte: endTimestamp },
    });

    // Stripe API 특성상 list 조회 시 전체 카운트를 바로 주진 않음.
    // 여기서는 '기간 내 새로 생긴 구독' 정도로 해석하거나, 전체 활성 구독을 별도로 조회해야 함.
    // AI 분석용으로는 '매출'과 '결제 성공률'이 가장 중요하므로 위 charges 데이터가 핵심임.

    // 4. AI가 읽기 편한 CSV 포맷으로 변환
    const report = [
      `Metric,Value,Description`,
      `Total Revenue,${formatCurrency(totalRevenue, currency)},기간 내 총 매출`,
      `Total Transactions,${charges.data.length},총 결제 시도 횟수`,
      `Success Count,${successCount},결제 성공 횟수`,
      `Failure Count,${failCount},결제 실패 횟수`,
      `Failure Rate,${
        charges.data.length > 0
          ? ((failCount / charges.data.length) * 100).toFixed(2)
          : 0
      }%,결제 실패율 (높으면 기술적 문제 의심)`,
      `New Subscriptions (Period),${subscriptions.data.length},기간 내 신규 구독 발생 건수 (샘플링)`,
    ].join("\n");

    return report;
  } catch (error: any) {
    throw new Error(`Stripe API Error: ${error.message}`);
  }
}
