// pages/baby/[babyNumber].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";import { useCallback } from "react";
import {
  collection, getDocs, setDoc, doc,
  getDoc, query, Timestamp,
} from "firebase/firestore";
import { format, addDays } from "date-fns";
import WeekTips from "@/pages/components/weektips"; // 컴포넌트 분리 시 import 필요
import "../../lib/i18n";
import { useTranslation } from "react-i18next";


import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  CartesianGrid,
} from 'recharts';


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
  padding: "10px",
  border: "1px solid #ccc",
  fontWeight: "bold",
  textAlign: "center" as const,
};

const tdStyle = {
  padding: "10px",
  border: "1px solid #ccc",
  textAlign: "center" as const,
  minWidth: "60px",
};


export default function BabyPage() {
  const router = useRouter();
  const { babyNumber } = router.query;
  const [babyInfo, setBabyInfo] = useState<Baby | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState<string>("00:00");
  const [recordType, setRecordType] = useState("feeding");
  const [value, setValue] = useState("");
  const [weight, setWeight] = useState("");
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation(); // ✅ 이 줄을 추가
  

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

  const fetchRecords = useCallback(async () => {
    if (!babyInfo) return;
    const end = new Date(selectedDate);
    const start = addDays(end, -6);
    const q = query(collection(db, `babies/${babyInfo.id}/records`));
    const snapshot = await getDocs(q);
    const result: RecordEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.date && data.date >= format(start, "yyyy-MM-dd") && data.date <= format(end, "yyyy-MM-dd")) {
        result.push(data as RecordEntry);
      }
    });
    setRecords(result);
  }, [babyInfo, selectedDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
    await fetchRecords(); 

  };
  


  const [showBreastDetails, setShowBreastDetails] = useState(false);


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

 
  const dailyRecords = records
    .filter((r) => r.date === selectedDate)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  const timesWithRecords = Array.from(new Set(dailyRecords.map(r => r.time))).sort();

  const dailyGrouped = timesWithRecords.map((time) => {
    const feeding = dailyRecords.find(r => r.time === time && r.type === "feeding")?.value || "";
    const breastmilk_ml = dailyRecords.find(r => r.time === time && r.type === "breastmilk_ml")?.value || "";
    const breastmilk = dailyRecords.find(r => r.time === time && r.type === "breastmilk")?.value || "";
    const urine = dailyRecords.find(r => r.time === time && r.type === "urine")?.value || "";
    const poop = dailyRecords.find(r => r.time === time && r.type === "poop")?.value || "";
    return { time, feeding, breastmilk_ml, breastmilk, urine, poop };
  });
  

  const weeklySummary = Array.from({ length: 7 }, (_, i) => {
    const date = format(addDays(new Date(selectedDate), -6 + i), "yyyy-MM-dd");
    const dayRecords = records.filter((r) => r.date === date);
  
    const feeding = dayRecords.filter((r) => r.type === "feeding").reduce((sum, r) => sum + r.value, 0);
    const breastDirect = dayRecords.filter((r) => r.type === "breastmilk").reduce((sum, r) => sum + r.value, 0);
    const breastExtracted = dayRecords.filter((r) => r.type === "breastmilk_ml").reduce((sum, r) => sum + r.value, 0);
    const breastToMl = breastDirect * 5;
    const total = feeding + breastExtracted + breastToMl;
  
    const urine = dayRecords.filter((r) => r.type === "urine").length;
    const poop = dayRecords.filter((r) => r.type === "poop").length;
    const weight = dayRecords.find((r) => r.type === "weight")?.value || null;
  
    // 권장 수유량 계산 (예: 몸무게 × 120 ~ 160ml)
    let recommendedMin = null;
    let recommendedMax = null;
    let evaluation = null;
  
    if (weight) {
      recommendedMin = Math.round(weight * 120);
      recommendedMax = Math.round(weight * 160);
  
      if (total < recommendedMin) {
        evaluation = "부족";
      } else if (total > recommendedMax) {
        evaluation = "과다";
      } else {
        evaluation = "적정";
      }
    }
  
    return {
      date,
      feeding,
      breastDirect,
      breastExtracted,
      breastToMl,
      urine,
      poop,
      weight,
      recommendedMin,
      recommendedMax,
      evaluation,
    };
  });
  

  const chartData = weeklySummary.map(day => ({
    date: day.date.slice(5),
    total: day.feeding + day.breastToMl + day.breastExtracted,
    feeding: day.feeding,
    breast: day.breastToMl,
    breastExtracted: day.breastExtracted,
  }));
  



    // ✅ AI 분석 결과 생성 함수
    const generateAIAnalysis = () => {
      if (!weeklySummary || weeklySummary.length === 0) return null;
    
      const lastDay = weeklySummary[6];
      const firstDay = weeklySummary[0];
      const totalFeedingMl = weeklySummary.reduce((sum, d) =>
        sum + d.feeding + d.breastToMl + d.breastExtracted, 0);
            const avgFeeding = Math.round(totalFeedingMl / 7);
      const weightChange = lastDay.weight && firstDay.weight ? lastDay.weight - firstDay.weight : null;
      const messages = [];
    
      // ✅ 수유량 평균
      if (avgFeeding < 400) {
        messages.push("⚠️ 하루 평균 수유량이 적어요. 충분히 먹고 있는지 확인해주세요.");
      } else {
        messages.push("✅ 하루 평균 수유량이 적정 수준입니다.");
      }
    
      // ✅ 수유량 변동성 분석
      const feedingAmounts = weeklySummary.map(d => d.feeding + d.breastToMl);
      const max = Math.max(...feedingAmounts);
      const min = Math.min(...feedingAmounts);
      const diff = max - min;
      if (diff > 200) {
        messages.push("📉 수유량의 일간 변동폭이 커요. 일정한 패턴을 만들어주세요.");
      } else {
        messages.push("📈 수유량이 안정적으로 유지되고 있어요.");
      }
    
      // ✅ 체중 변화
      if (weightChange !== null) {
        if (weightChange < 0) {
          messages.push(`⚠️ 체중이 감소했어요 (${firstDay.weight}kg → ${lastDay.weight}kg).`);
        } else if (weightChange === 0) {
          messages.push("ℹ️ 이번 주 동안 체중 변화가 없었습니다.");
        } else {
          messages.push(`✅ 체중이 증가했어요! (+${weightChange.toFixed(2)}kg)`);
        }
      }
    
      // ✅ 배변 리듬 분석
      const poopDays = weeklySummary.map(d => d.poop);
      const zeroPoop = poopDays.filter(c => c === 0).length;
      if (zeroPoop >= 3) {
        messages.push("🚨 이번 주 중 3일 이상 대변 기록이 없습니다. 변비 가능성을 확인해주세요.");
      } else if (poopDays.every(c => c >= 1)) {
        messages.push("✅ 대변이 매일 규칙적으로 있었습니다.");
      } else {
        messages.push("ℹ️ 배변 패턴이 불규칙합니다. 추이를 관찰해주세요.");
      }
    
      return messages;
    };
    
    
    
      const aiMessages = generateAIAnalysis();


      const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
      };
    




      return (

        
        
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px", backgroundColor: "#ffffff", color: "#000" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center" }}>
            {babyInfo ? `${babyInfo.name} ${t("page")}` : `👶 ${t("baby_main_page")}`}
          </h1>


          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "16px" }}>
          <button onClick={() => changeLanguage('ko')} style={{ padding: '6px 10px' }}>🇰🇷 한국어</button>
          <button onClick={() => changeLanguage('en')} style={{ padding: '6px 10px' }}>🇺🇸 English</button>
          <button onClick={() => changeLanguage('vi')} style={{ padding: '6px 10px' }}>🇻🇳 Tiếng Việt</button>
        </div>

          {babyInfo && (
            <div
              style={{
                backgroundColor: "#f9f9ff",
                padding: "20px",
                borderRadius: "12px",
                marginTop: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", display: "flex", alignItems: "center" }}>
                👤 <span style={{ marginLeft: "8px" }}>{t("baby_info")}</span>
              </h2>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ flex: "1 1 45%", minWidth: "140px" }}>
                  <p style={{ margin: "6px 0" }}><strong>🧸 {t("name")}:</strong> {babyInfo.name}</p>
                  <p style={{ margin: "6px 0" }}><strong>🎂 {t("birthdate")}:</strong> {babyInfo.birthdate}</p>
                </div>
                <div style={{ flex: "1 1 45%", minWidth: "140px" }}>
                  <p style={{ margin: "6px 0" }}><strong>🚻 {t("gender")}:</strong> {babyInfo.gender === "male" ? t("boy") : t("girl")}</p>
                  <p style={{ margin: "6px 0" }}><strong>🆔 {t("baby_number")}:</strong> {babyInfo.babyNumber}</p>
                </div>
              </div>

              <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #ddd" }} />

              <p style={{ fontSize: "15px", fontWeight: "bold", color: "#555" }}>
                ⏳ {t("days_since_birth")} <span style={{ color: "#000" }}>{calculateDaysSinceBirth(babyInfo.birthdate)} {t("days")}</span>
              </p>
            </div>
          )}

          <div
            style={{
              borderRadius: "8px",
              marginTop: "16px",
              fontSize: "16px",
              whiteSpace: "pre-line",
              lineHeight: "1.6",
            }}
          >
            {babyInfo && <WeekTips birthDate={babyInfo.birthdate} />}
          </div>
        

      

           {/* 좌우 카드 전체 레이아웃 */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: "20px",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            {/* 좌측 카드 */}
            <div
              style={{
                flex: "1",
                minWidth: "280px",
                height: "100%",
                backgroundColor: "#e6f0ff",
                padding: "24px",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ fontWeight: "bold", marginBottom: "16px" }}>
                  📅 {t("select_date_and_time")}
                </h3>

                {/* 날짜 선택 */}
                <div style={{ marginBottom: "20px" }}>
                  <label>{t("date")}:</label><br />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      padding: "10px",
                      width: "100%",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                    }}
                  />
                </div>

                {/* 시간 선택 */}
                <div>
                  <label>🕒 {t("select_time")}:</label>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <select
                      value={selectedTime.split(":")[0]}
                      onChange={(e) => {
                        const hour = e.target.value.padStart(2, "0");
                        const min = selectedTime.split(":")[1] || "00";
                        setSelectedTime(`${hour}:${min}`);
                      }}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      {Array.from({ length: 25 }).map((_, i) => (
                        <option key={i} value={String(i).padStart(2, "0")}>
                          {String(i).padStart(2, "0")}{t("hour_suffix")}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedTime.split(":")[1]}
                      onChange={(e) => {
                        const min = e.target.value.padStart(2, "0");
                        const hour = selectedTime.split(":")[0] || "00";
                        setSelectedTime(`${hour}:${min}`);
                      }}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option key={m} value={m}>
                          {m}{t("minute_suffix")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
       


  {/* 공간 균형용 빈 div */}
  <div style={{ height: "10px" }}></div>
</div>
   

 {/* 우측 카드 컨테이너 */}
<div
  style={{
    flex: "2",
    minWidth: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  }}
>
  
{/* ✅ 상단 카드: 기록 입력 */}
<div
  style={{
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "#e9f8e9",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  }}
>
  <h3 style={{ fontWeight: "bold", marginBottom: "16px" }}>📋 {t("record_input")}</h3>

  {/* 항목 선택 */}
  <div style={{ marginBottom: "16px" }}>
    <label style={{ display: "block", marginBottom: "4px" }}>
      📌 {t("select_item")}:
    </label>
    <select
      value={recordType}
      onChange={(e) => setRecordType(e.target.value)}
      style={{
        padding: "8px",
        width: "100%",
        borderRadius: "4px",
        border: "1px solid #ccc",
      }}
    >
      <option value="feeding">🍼 {t("formula")}</option>
      <option value="breastmilk_ml">🍼 {t("expressed_breastmilk")}</option>
      <option value="breastmilk">🤱 {t("direct_breastfeeding")}</option>
      <option value="urine">💧 {t("urine")}</option>
      <option value="poop">💩 {t("poop")}</option>
    </select>
  </div>

  {/* 입력 값 */}
  <div style={{ marginBottom: "16px" }}>
    <label style={{ display: "block", marginBottom: "4px" }}>
      💾 {t("input_value")}:
    </label>
    <input
      type="number"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={t("input_example")}
      style={{
        padding: "8px",
        width: "100%",
        borderRadius: "4px",
        border: "1px solid #ccc",
      }}
    />
  </div>

  <button
    onClick={() => {
      if (loading || !value || !selectedTime || !recordType) return;
      handleSave();
    }}
    disabled={loading || !value || !selectedTime || !recordType}
    style={{
      width: "100%",
      padding: "10px",
      backgroundColor: "#2b72ff",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: loading ? "not-allowed" : "pointer",
    }}
  >
    {loading ? t("saving") : t("save_record")}
  </button>
</div>

{/* ✅ 하단 카드: 몸무게 입력 */}
<div
  style={{
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "#fff8e1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  }}
>
  <h3 style={{ fontWeight: "bold", marginBottom: "16px" }}>⚖️ {t("weight_input")}</h3>

  <input
    type="number"
    value={weight}
    onChange={(e) => setWeight(e.target.value)}
    placeholder={t("weight_placeholder")}
    style={{
      padding: "8px",
      width: "100%",
      marginBottom: "12px",
      borderRadius: "4px",
      border: "1px solid #ccc",
    }}
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
      alert(t("weight_saved"));
    }}
    disabled={!weight}
    style={{
      width: "100%",
      padding: "10px",
      backgroundColor: "#28a745",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: !weight ? "not-allowed" : "pointer",
    }}
  >
    {t("save_weight")}
  </button>
</div>
</div>

</div>


  {/* 일간 테이블 */}
<div
  style={{
    marginTop: "40px",
    padding: "16px",
    backgroundColor: "#fdfdfd",
    borderRadius: "8px",
    overflowX: "auto",
  }}
>
  <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
    📋 {t("daily_record")} ({selectedDate})
  </h2>

  {dailyGrouped.length > 0 ? (
    <table
      style={{
        width: "100%",
        tableLayout: "fixed",
        borderCollapse: "collapse",
        marginTop: "16px",
        backgroundColor: "#ffffff",
        color: "#000",
        border: "1px solid #ccc",
        fontSize: "14px",
      }}
    >
      <thead style={{ backgroundColor: "#f0f0f0" }}>
        <tr>
          <th style={{ ...thStyle, width: "12%" }}>{t("time")}</th>
          <th style={{ ...thStyle, width: "12%" }}>{t("formula_milk")}</th>
          <th style={{ ...thStyle, width: "12%" }}>{t("breastmilk_expressed")}</th>
          <th style={{ ...thStyle, width: "12%" }}>{t("breastmilk_direct")}</th>
          <th style={{ ...thStyle, width: "12%" }}>{t("urine")}</th>
          <th style={{ ...thStyle, width: "12%" }}>{t("poop")}</th>
          <th style={{ ...thStyle, width: "16%" }}>{t("delete")}</th>
        </tr>
      </thead>
      <tbody>
        {dailyGrouped.map((row, idx) => (
          <tr key={idx}>
            <td style={tdStyle}>{row.time}</td>

            {["feeding", "breastmilk_ml", "breastmilk", "urine", "poop"].map((key) => (
              <td
                key={key}
                style={{
                  ...tdStyle,
                  backgroundColor: "#fffbea",
                }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const newValue = e.currentTarget.textContent?.trim() || "";
                  if (newValue && row.time) {
                    handleUpdateRecord(row.time, key as keyof typeof row, newValue);
                  }
                }}
              >
                {row[key as keyof typeof row]}
              </td>
            ))}

            <td style={{ ...tdStyle }}>
              <button
                onClick={async () => {
                  if (!babyInfo || !row.time) return;
                  const types = ["feeding", "breastmilk_ml", "breastmilk", "urine", "poop"];
                  const promises = types.map((type) => {
                    const recordId = `${selectedDate}-${row.time}-${type}`;
                    return doc(db, `babies/${babyInfo.id}/records`, recordId);
                  });
                  try {
                    await Promise.all(promises.map((ref) => setDoc(ref, {}, { merge: false })));
                    await fetchRecords();
                    alert(`🗑️ ${row.time}${t("record_deleted")}`);
                  } catch (err) {
                    console.error("삭제 오류:", err);
                    alert(t("error_deleting"));
                  }
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  backgroundColor: "#ff6b6b",
                  color: "#fff",
                  border: "1px solid #f5a3a3",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {t("delete")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p style={{ fontSize: "13px", color: "#888" }}>{t("no_record")}</p>
  )}
</div>






     {/* 주간 테이블 */} 
<div
  style={{
    marginTop: "40px",
    padding: "16px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    overflowX: "auto",
  }}
>
  <h2 style={{ marginBottom: "16px" }}>📊 {t("weekly_summary")}</h2>

  <table
    style={{
      minWidth: "700px",
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "14px",
      textAlign: "center" as const,
      border: "1px solid #ccc",
    }}
  >
    <thead>
      <tr style={{ backgroundColor: "#f0f0f0", lineHeight: "1.6" }}>
        <th style={{ padding: "12px 8px" }} rowSpan={2}>{t("category")}</th>
        <th style={{ padding: "12px 8px" }} rowSpan={2}>{t("sub_category")}</th>
        {weeklySummary.map((day, i) => (
          <th key={i} style={{ padding: "12px 8px" }}>{day.date.slice(5)}</th>
        ))}
      </tr>
      <tr />
    </thead>
    <tbody>
      {/* 수유량 */}
      <tr style={{ lineHeight: "1.6" }}>
        <td style={{ padding: "12px 8px" }} rowSpan={showBreastDetails ? 5 : 3}>🍼 {t("feeding")}</td>
        <td style={{ padding: "12px 8px" }}>{t("formula_milk")}</td>
        {weeklySummary.map((d, i) => (
          <td key={i} style={{ padding: "12px 8px" }}>{d.feeding}ml</td>
        ))}
      </tr>

      <tr
        style={{ lineHeight: "1.6", cursor: "pointer", backgroundColor: "#f9f9f9" }}
        onClick={() => setShowBreastDetails(!showBreastDetails)}
      >
        <td style={{ padding: "12px 8px" }}>{t("breastmilk_total")}</td>
        {weeklySummary.map((d, i) => (
          <td key={i} style={{ padding: "12px 8px" }}>{d.breastExtracted + d.breastToMl}ml</td>
        ))}
      </tr>

      {showBreastDetails && (
        <>
          <tr style={{ backgroundColor: "#f1f1f1" }}>
            <td style={{ padding: "8px", textAlign: "left", fontSize: "12px" }}>┗ {t("breastmilk_expressed")}</td>
            {weeklySummary.map((d, i) => (
              <td key={i} style={{ padding: "8px", fontSize: "12px" }}>{d.breastExtracted}ml</td>
            ))}
          </tr>
          <tr style={{ backgroundColor: "#f1f1f1" }}>
            <td style={{ padding: "8px", textAlign: "left", fontSize: "12px" }}>┗ {t("breastmilk_direct")}</td>
            {weeklySummary.map((d, i) => (
              <td key={i} style={{ padding: "8px", fontSize: "12px" }}>
                {d.breastDirect}분 ({d.breastToMl}ml)
              </td>
            ))}
          </tr>
        </>
      )}

      <tr style={{ fontWeight: "bold", lineHeight: "1.6" }}>
        <td style={{ padding: "12px 8px" }}>{t("feeding_total")}</td>
        {weeklySummary.map((d, i) => (
          <td key={i} style={{ padding: "12px 8px" }}>
            {d.feeding + d.breastExtracted + d.breastToMl}ml
          </td>
        ))}
      </tr>

      <tr><td colSpan={weeklySummary.length + 2} style={{ height: "10px" }}></td></tr>

      {/* 대소변 */}
      <tr style={{ lineHeight: "1.6" }}>
        <td style={{ padding: "12px 8px" }} rowSpan={2}>💧 {t("toilet")}</td>
        <td style={{ padding: "12px 8px" }}>{t("urine")}</td>
        {weeklySummary.map((d, i) => (
          <td key={i} style={{ padding: "12px 8px" }}>{d.urine || "0"}{t("times")}</td>
        ))}
      </tr>
      <tr style={{ lineHeight: "1.6" }}>
        <td style={{ padding: "12px 8px" }}>{t("poop")}</td>
        {weeklySummary.map((d, i) => (
          <td key={i} style={{ padding: "12px 8px" }}>{d.poop || "0"}{t("times")}</td>
        ))}
      </tr>

      <tr><td colSpan={weeklySummary.length + 2} style={{ height: "10px" }}></td></tr>

      {/* 몸무게 */}
      <tr style={{ lineHeight: "1.6" }}>
        <td colSpan={2} style={{ padding: "12px 8px" }}>⚖️ {t("weight")}</td>
        {weeklySummary.map((d, i) => (
          <td key={i} style={{ padding: "12px 8px" }}>{d.weight ? `${d.weight}kg` : "-"}</td>
        ))}
      </tr>

      {/* 권장 수유량 */}
      <tr style={{ lineHeight: "1.6" }}>
        <td colSpan={2} style={{ padding: "12px 8px" }}>🎯 {t("recommended_feeding")}</td>
        {weeklySummary.map((d, i) => (
          <td key={i} style={{ padding: "12px 8px" }}>
            {d.recommendedMin && d.recommendedMax
              ? `${d.recommendedMin}~${d.recommendedMax}ml`
              : "-"}
          </td>
        ))}
      </tr>

      {/* 평가 */}
      <tr style={{ lineHeight: "1.6" }}>
        <td colSpan={2} style={{ padding: "12px 8px" }}>📝 {t("evaluation")}</td>
        {weeklySummary.map((d, i) => (
          <td
            key={i}
            style={{
              padding: "12px 8px",
              color:
                d.evaluation === "부족"
                  ? "red"
                  : d.evaluation === "과다"
                  ? "blue"
                  : d.evaluation === "적정"
                  ? "green"
                  : "#888",
              fontWeight: "bold",
            }}
          >
            {t(d.evaluation || "-")}
          </td>
        ))}
      </tr>
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



            <div
              style={{
                marginTop: "40px",
                padding: "16px",
                backgroundColor: "#fffaf0",
                borderRadius: "8px",
              }}
            >
              <h2>📊 주간 수유량 차트</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="총합"
                    stroke="#ff7300"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                  <Brush
                    dataKey="date"
                    height={30}
                    stroke="#8884d8"
                    startIndex={Math.max(chartData.length - 7, 0)}
                    endIndex={chartData.length - 1}
                    travellerWidth={10}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>


    


          
        </div>
      );
      
      
}
