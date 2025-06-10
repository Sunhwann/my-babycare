// pages/baby/[babyNumber].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, setDoc, doc,
  getDoc, query, Timestamp,
} from "firebase/firestore";
import { format, startOfWeek, addDays } from "date-fns";

interface Baby {
  id: string;
  name: string;
  birthdate: string;
  gender: string;
  babyNumber: string;
}

interface RecordEntry {
  date: string;
  type: string;
  value: number;
  time?: string;
}

const thStyle = {
    padding: "8px",
    border: "1px solid #ccc",
    fontWeight: "bold" as const,
    textAlign: "center" as const,
  };
  
  const tdStyle = {
    padding: "8px",
    border: "1px solid #ccc",
  };
  

export default function BabyPage() {
  const router = useRouter();
  const { babyNumber } = router.query;
  const [babyInfo, setBabyInfo] = useState<Baby | null>(null);
  const [activeTab, setActiveTab] = useState<"input" | "output" | "ai">("input");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState<string>("00:00");
  const [recordType, setRecordType] = useState("feeding");
  const [value, setValue] = useState("");
  const [weight, setWeight] = useState("");
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  

  useEffect(() => {
    if (!babyNumber) return;
    const fetchBaby = async () => {
      const docRef = doc(db, "babies", babyNumber as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setBabyInfo({ id: snap.id, ...(snap.data() as Omit<Baby, "id">) });
      }
    };
    fetchBaby();
  }, [babyNumber]);

  const calculateDaysSinceBirth = (birthdate: string) => {
    const birth = new Date(birthdate);
    const today = new Date();
    return Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleUpdateRecord = async (time: string, type: string, newValue: string | null) => {
    if (!babyInfo || !selectedDate || !newValue) return;
    const recordId = `${selectedDate}-${time}-${type}`;
    const docRef = doc(db, `babies/${babyInfo.id}/records`, recordId);
    await setDoc(docRef, {
      date: selectedDate,
      time,
      type,
      value: Number(newValue),
      updatedAt: Timestamp.now(),
    });
    fetchRecords();
  };
  

  const handleSave = async () => {
    if (!babyInfo || !value || !selectedTime || !selectedDate || !recordType) return;
    setLoading(true);
    const recordId = `${selectedDate}-${selectedTime}-${recordType}`;
    const docRef = doc(db, `babies/${babyInfo.id}/records`, recordId);
    await setDoc(docRef, {
      date: selectedDate,
      time: selectedTime,
      type: recordType,
      value: Number(value),
      createdAt: Timestamp.now(),
    });
    if (weight) {
      const weightRef = doc(db, `babies/${babyInfo.id}/records`, `${selectedDate}-weight`);
      await setDoc(weightRef, {
        date: selectedDate,
        type: "weight",
        value: Number(weight),
        createdAt: Timestamp.now(),
      });
    }
    setValue("");
    setWeight("");
    await fetchRecords();
    setLoading(false);
    alert("✅ 저장 완료!");
  };

 

  const fetchRecords = async () => {
    if (!babyInfo) return;
    const start = startOfWeek(new Date(selectedDate), { weekStartsOn: 0 });
    const end = addDays(start, 6);
    const q = query(collection(db, `babies/${babyInfo.id}/records`));
    const snapshot = await getDocs(q);
    const result: RecordEntry[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.date);
      if (date >= start && date <= end) {
        result.push(data as RecordEntry);
      }
    });
    setRecords(result);
  };

  useEffect(() => {
    fetchRecords();
  }, [babyInfo, selectedDate]);

  const dailyRecords = records
    .filter((r) => r.date === selectedDate)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  const timesWithRecords = Array.from(new Set(dailyRecords.map(r => r.time))).sort();

  const dailyGrouped = timesWithRecords.map((time) => {
    const feeding = dailyRecords.find(r => r.time === time && r.type === "feeding")?.value || "";
    const breastmilk = dailyRecords.find(r => r.time === time && r.type === "breastmilk")?.value || "";
    const urine = dailyRecords.find(r => r.time === time && r.type === "urine")?.value || "";
    const poop = dailyRecords.find(r => r.time === time && r.type === "poop")?.value || "";
    return { time, feeding, breastmilk, urine, poop };
  });

  const weeklySummary = Array.from({ length: 7 }, (_, i) => {
    const date = format(addDays(startOfWeek(new Date(selectedDate), { weekStartsOn: 0 }), i), "yyyy-MM-dd");
    const dayRecords = records.filter((r) => r.date === date);
    const feeding = dayRecords.filter((r) => r.type === "feeding").reduce((sum, r) => sum + r.value, 0);
    const breastfeeding = dayRecords.filter((r) => r.type === "breastmilk").reduce((sum, r) => sum + r.value, 0);
    const breastToMl = breastfeeding * 5; // 환산 공식: 1분당 5ml
    const urine = dayRecords.filter((r) => r.type === "urine").length;
    const poop = dayRecords.filter((r) => r.type === "poop").length;
    const weight = dayRecords.find((r) => r.type === "weight")?.value || null;
    return { date, feeding, breastfeeding, breastToMl, urine, poop, weight };
  });


    // ✅ AI 분석 결과 생성 함수
    const generateAIAnalysis = () => {
        if (!weeklySummary || weeklySummary.length === 0) return null;
    
        const lastDay = weeklySummary[6];
        const firstDay = weeklySummary[0];
        const totalFeedingMl = weeklySummary.reduce((sum, d) => sum + d.feeding + d.breastToMl, 0);
        const avgFeeding = Math.round(totalFeedingMl / 7);
    
        const weightChange =
          lastDay.weight && firstDay.weight ? lastDay.weight - firstDay.weight : null;
    
        const messages = [];
    
        if (avgFeeding < 400) {
          messages.push("⚠️ 하루 평균 수유량이 적어요. 충분히 먹고 있는지 확인해주세요.");
        } else {
          messages.push("✅ 하루 평균 수유량이 적정 수준입니다.");
        }
    
        if (weightChange !== null) {
          if (weightChange < 0) {
            messages.push(`⚠️ 체중이 감소했어요 (${firstDay.weight}kg → ${lastDay.weight}kg).`);
          } else if (weightChange === 0) {
            messages.push("ℹ️ 이번 주 동안 체중 변화가 없었습니다.");
          } else {
            messages.push(`✅ 체중이 증가했어요! (+${weightChange.toFixed(2)}kg)`);
          }
        }
    
        const poopCount = weeklySummary.reduce((sum, d) => sum + d.poop, 0);
        if (poopCount < 3) {
          messages.push("💩 대변 횟수가 적습니다. 변비 여부를 확인해주세요.");
        }
    
        return messages;
      };
    
      const aiMessages = generateAIAnalysis();
    




      return (
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px", backgroundColor: "#ffffff", color: "#000" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center" }}>
            {babyInfo ? `${babyInfo.name} 페이지` : "👶 아기 메인 페이지"}
          </h1>
      
          {babyInfo && (
            <div style={{ backgroundColor: "#f1f1f1", padding: "16px", borderRadius: "8px", marginTop: "16px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>👤 아기 정보</h2>
              <p><strong>이름:</strong> {babyInfo.name}</p>
              <p><strong>생년월일:</strong> {babyInfo.birthdate}</p>
              <p><strong>성별:</strong> {babyInfo.gender === "male" ? "남아" : "여아"}</p>
              <p><strong>아기번호:</strong> {babyInfo.babyNumber}</p>
              <p><strong>출생 {calculateDaysSinceBirth(babyInfo.birthdate)}일째</strong></p>
            </div>
          )}
      
          <div style={{ marginTop: "20px" }}>
            <label><strong>📅 날짜 선택:</strong></label><br />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "8px", marginTop: "4px", width: "100%" }}
            />
          </div>
      
          {/* 입력 섹션 */}
          <div style={{ marginTop: "20px", backgroundColor: "#fdfdfd", borderRadius: "8px", padding: "16px" }}>
            <h3>📝 기록 입력</h3>
            <div style={{ marginBottom: "16px" }}>
              <label>🕒 시간 (15분 단위):</label><br />
              <input
                type="time"
                step="900"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                style={{ padding: "8px", width: "100%" }}
              />
            </div>
      
            <div style={{ marginBottom: "16px" }}>
              <label>📌 항목 선택:</label><br />
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                style={{ padding: "8px", width: "100%" }}
              >
                <option value="feeding">🍼 분유</option>
                <option value="breastmilk">🤱 모유 (분)</option>
                <option value="urine">💧 소변</option>
                <option value="poop">💩 대변</option>
              </select>
            </div>
      
            <div style={{ marginBottom: "16px" }}>
              <label>💾 입력 값:</label><br />
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="수유량 (ml) / 모유 시간 (분) / 1회"
                style={{ padding: "8px", width: "100%" }}
              />
            </div>
      
            <button
              onClick={() => {
                if (loading || !value || !selectedTime || !recordType) return;
                handleSave();
              }}
              disabled={loading || !value || !selectedTime || !recordType}
              style={{ padding: "10px 20px", backgroundColor: "#2b72ff", color: "#fff", border: "none", borderRadius: "4px" }}
            >
              {loading ? "저장 중..." : "기록 저장하기"}
            </button>
      
            <div style={{ marginTop: "20px" }}>
              <label>⚖️ 몸무게 (kg):</label><br />
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="몸무게 입력"
                style={{ padding: "8px", width: "100%" }}
              />
              <button
                onClick={async () => {
                  if (!babyInfo || !weight) return;
                  const weightRef = doc(db, `babies/${babyInfo.id}/records`, `${selectedDate}-weight`);
                  await setDoc(weightRef, {
                    date: selectedDate,
                    type: "weight",
                    value: Number(weight),
                    createdAt: Timestamp.now(),
                  });
                  setWeight("");
                  fetchRecords();
                  alert("✅ 몸무게 저장 완료!");
                }}
                disabled={!weight}
                style={{ marginTop: "8px", padding: "10px 20px", backgroundColor: "#28a745", color: "#fff", border: "none", borderRadius: "4px" }}
              >
                몸무게 저장하기
              </button>
            </div>
          </div>
      
          {/* 데일리 기록 출력 */}
          <div style={{ marginTop: "40px", padding: "16px", backgroundColor: "#fdfdfd", borderRadius: "8px" }}>
            <h2>📋 데일리 기록 ({selectedDate})</h2>
      
         {dailyGrouped.length > 0 ? (
                  <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: "16px",
                    backgroundColor: "#ffffff",
                    color: "#000",
                    border: "1px solid #ccc",
                  }}
                >
                  <thead style={{ backgroundColor: "#f0f0f0" }}>
                    <tr>
                      <th style={thStyle}>시간</th>
                      <th style={thStyle}>분유(ml)</th>
                      <th style={thStyle}>모유(분)</th>
                      <th style={thStyle}>소변</th>
                      <th style={thStyle}>대변</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyGrouped.map((row, idx) => (
                      <tr key={idx}>
                        <td style={tdStyle}>{row.time}</td>
                        {["feeding", "breastmilk", "urine", "poop"].map((type) => (
                          <td
                            key={type}
                            style={{
                              ...tdStyle,
                              backgroundColor: "#fffbe6",
                              cursor: "pointer",
                              textAlign: "center",
                            }}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newValue = e.currentTarget.textContent?.trim() || "";
                              if (newValue && row.time !== "합계") {
                                handleUpdateRecord(row.time!, type, newValue);
                              }
                            }}
                          >
                            {row[type as keyof typeof row]}
                          </td>
                        ))}
                      </tr>
                    ))}
                
                    {/* ✅ 마지막 요약 행 */}
                    <tr style={{ backgroundColor: "#f9f9f9", fontWeight: "bold" }}>
                      <td style={tdStyle}>합계</td>
                      <td style={tdStyle}>
                        {dailyGrouped.reduce((sum, r) => sum + Number(r.feeding || 0), 0)}
                      </td>
                      <td style={tdStyle}>
                        {dailyGrouped.reduce((sum, r) => sum + Number(r.breastmilk || 0), 0)}
                      </td>
                      <td style={tdStyle}>
                        {dailyGrouped.reduce((sum, r) => sum + Number(r.urine || 0), 0)}
                      </td>
                      <td style={tdStyle}>
                        {dailyGrouped.reduce((sum, r) => sum + Number(r.poop || 0), 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                
                
                ) : <p>기록 없음</p>}
      
          </div>
      
          {/* 주간 요약 출력 */}
          <div style={{ marginTop: "40px", padding: "16px", backgroundColor: "#fdfdfd", borderRadius: "8px" }}>
            <h2>📆 주간 요약</h2>
      
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
                  <thead>
                      <tr style={{ backgroundColor: "#f0f0f0", textAlign: "center" }}>
                      <th style={{ padding: "8px" }}>날짜</th>
                      <th>분유(ml)</th>
                      <th>모유(분)</th>
                      <th>모유 환산(ml)</th>
                      <th>총 수유량</th>
                      <th>소변</th>
                      <th>대변</th>
                      <th>몸무게</th>
                      </tr>
                  </thead>
                  <tbody>
                      {weeklySummary.map((day, i) => (
                      <tr key={i} style={{ textAlign: "center", borderTop: "1px solid #ddd" }}>
                          <td style={{ padding: "8px" }}>{day.date}</td>
                          <td>{day.feeding}</td>
                          <td>{day.breastfeeding}</td>
                          <td>{day.breastToMl}</td>
                          <td style={{ fontWeight: "bold" }}>{day.feeding + day.breastToMl}</td>
                          <td>{day.urine}</td>
                          <td>{day.poop}</td>
                          <td>{day.weight !== null ? `${day.weight}kg` : "-"}</td>
                      </tr>
                      ))}
                  </tbody>
                  </table>
      
          </div>
      
          {/* AI 분석 */}
          <div style={{ marginTop: "40px", padding: "16px", backgroundColor: "#eef5ff", borderRadius: "8px" }}>
            <h2>🤖 AI 분석 결과</h2>
            {aiMessages && aiMessages.length > 0 ? (
              <ul style={{ lineHeight: "1.8" }}>
                {aiMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            ) : (
              <p>분석할 데이터가 부족합니다. 일주일 이상의 기록이 필요합니다.</p>
            )}
          </div>
        </div>
      );
      
      
}