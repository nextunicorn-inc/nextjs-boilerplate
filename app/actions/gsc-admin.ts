"use server";

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

// 구글 서치 콘솔 사이트 목록 가져오기
export async function getGscSites(accessToken: string): Promise<GscSite[]> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch GSC sites", await response.text());
      return [];
    }

    const data = await response.json();

    // 데이터가 없는 경우 빈 배열 반환
    if (!data.siteEntry) return [];

    return data.siteEntry.map((site: any) => ({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel,
    }));
  } catch (error) {
    console.error("Error fetching GSC sites:", error);
    return [];
  }
}
