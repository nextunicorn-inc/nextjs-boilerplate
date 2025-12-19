// /app/actions/getProperties.ts
"use server";

export async function getGA4Properties(accessToken: string) {
  try {
    const response = await fetch(
      "https://analyticsadmin.googleapis.com/v1alpha/accountSummaries",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();

    // 사용자가 가진 계정들과 그 안의 속성(Property) 목록을 파싱합니다.
    // 여기서 나온 propertyId들을 사용자에게 리스트로 보여주고 선택하게 하면 됩니다.
    return data.accountSummaries;
  } catch (error) {
    console.error("GA4 속성 목록을 가져오는데 실패했습니다.", error);
    return null;
  }
}
