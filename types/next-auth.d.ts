import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * 세션 객체에 기본 필드 외에 accessToken을 추가합니다.
   */
  interface Session {
    accessToken?: string;
    user: {
      /** 사용자 ID 등 추가 정보가 필요하면 여기 적습니다. */
      id?: string;
    } & DefaultSession["user"];
  }

  interface JWT {
    accessToken?: string;
  }
}
