"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { getGA4Properties } from "@/app/actions/getProperties"; // 아까 만든 서버 액션

export default function GASetupPage() {
  const { data: session } = useSession();
  const [properties, setProperties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // 세션이 생기면(로그인 성공 시) 자동으로 속성 리스트를 가져옴
  useEffect(() => {
    if (session?.accessToken && !selectedPropertyId) {
      fetchProperties(session.accessToken as string);
    }
  }, [session]);

  const fetchProperties = async (token: string) => {
    setLoading(true);
    const data = await getGA4Properties(token);
    if (data) {
      // 계정 요약 데이터에서 실제 속성(property)들만 추출하여 평탄화
      const allProps = data.flatMap(
        (account: any) => account.propertySummaries || []
      );
      setProperties(allProps);
      setIsModalOpen(true);
    }
    setLoading(false);
  };

  const handleSelect = (id: string) => {
    const cleanId = id.replace("properties/", ""); // 'properties/123' -> '123'
    setSelectedPropertyId(cleanId);
    setIsModalOpen(false);
    alert(`선택된 속성 ID: ${cleanId} - 이제 이 ID로 AI 분석을 시작합니다!`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      {/* 1. 메인 연동 버튼 */}
      {!selectedPropertyId ? (
        <button
          onClick={() => signIn("google")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-all transform hover:scale-105"
        >
          {loading ? "데이터 불러오는 중..." : "GA 연동하기"}
        </button>
      ) : (
        <div className="text-center">
          <p className="text-green-600 font-bold mb-2">연동 완료! ✅</p>
          <p className="text-gray-600">선택된 ID: {selectedPropertyId}</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 text-blue-500 underline"
          >
            다른 속성 선택하기
          </button>
        </div>
      )}

      {/* 2. 속성 선택 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">
              분석할 사이트를 선택해 주세요
            </h2>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
              {properties.length > 0 ? (
                properties.map((prop) => (
                  <button
                    key={prop.property}
                    onClick={() => handleSelect(prop.property)}
                    className="w-full text-left p-3 hover:bg-blue-50 rounded-lg border border-gray-100 transition-colors flex justify-between items-center group"
                  >
                    <span className="font-medium text-gray-700 group-hover:text-blue-600">
                      {prop.displayName}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {prop.property.split("/")[1]}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-center py-4 text-gray-500">
                  연결된 GA4 속성이 없습니다.
                </p>
              )}
            </div>

            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full py-2 text-gray-500 hover:text-gray-700 font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
