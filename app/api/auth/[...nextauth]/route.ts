import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// 🔄 1. 토큰 갱신 헬퍼 함수
async function refreshAccessToken(token: any) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // 새 refresh_token이 오면 그걸 쓰고, 안 오면 기존 것 유지
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("RefreshAccessTokenError", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // GA4, GSC 권한 요청
          scope:
            "openid email profile https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
          prompt: "consent",
          access_type: "offline", // ⭐ 중요: 리프레시 토큰을 받기 위해 필수
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // 1. 첫 로그인 시점
      if (account && user) {
        return {
          accessToken: account.access_token,
          // 토큰 만료 시간 계산 (현재시간 + 수명)
          accessTokenExpires:
            Date.now() + (account.expires_in as number) * 1000,
          refreshToken: account.refresh_token,
          user,
        };
      }

      // 2. 토큰이 아직 유효한 경우 (만료되지 않음)
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // 3. 토큰이 만료된 경우 -> 갱신 실행
      console.log("⚠️ Access Token 만료됨. 자동 갱신 시도...");
      return refreshAccessToken(token);
    },

    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.error = token.error; // 클라이언트에서 에러 확인용
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
