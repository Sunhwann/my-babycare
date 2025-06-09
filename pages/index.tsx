// pages/index.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";

interface Baby {
  name: string;
  birthdate: string;
  gender: string;
  babyNumber: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [newBaby, setNewBaby] = useState({
    name: "",
    birthdate: "",
    gender: "male",
  });

  const generateBabyNumber = async (birthdate: string) => {
    const datePart = birthdate.replace(/-/g, "");
    const prefix = datePart;
    const q = query(collection(db, "babies"));
    const snapshot = await getDocs(q);
    const filtered = snapshot.docs.filter(doc =>
      doc.id.startsWith(prefix)
    );
    const nextNum = (filtered.length + 1).toString().padStart(2, "0");
    return `${prefix}-${nextNum}`;
  };

  const fetchBabies = async () => {
    const q = query(collection(db, "babies"));
    const snapshot = await getDocs(q);
    const list: Baby[] = snapshot.docs.map((doc) => doc.data() as Baby);
    const sorted = list.sort((a, b) => b.babyNumber.localeCompare(a.babyNumber));
    setBabies(sorted);
  };

  useEffect(() => {
    fetchBabies();
  }, []);

  const handleCreateBaby = async () => {
    const { name, birthdate, gender } = newBaby;
    if (!name || !birthdate) return alert("이름과 생일을 입력하세요");
    const babyNumber = await generateBabyNumber(birthdate);
    await setDoc(doc(db, "babies", babyNumber), {
      name,
      birthdate,
      gender,
      babyNumber,
    });
    setNewBaby({ name: "", birthdate: "", gender: "male" });
    fetchBabies();
    alert("등록 완료!");
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-10 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-center text-gray-800">👶 아기 등록 관리자</h1>

      <div className="bg-white shadow p-6 rounded space-y-4">
        <h2 className="text-xl font-semibold text-gray-700">🆕 신규 아기 등록</h2>
        <input
          type="text"
          placeholder="이름"
          value={newBaby.name}
          onChange={(e) => setNewBaby({ ...newBaby, name: e.target.value })}
          className="w-full border p-2 rounded text-gray-800"
        />
        <input
          type="date"
          value={newBaby.birthdate}
          onChange={(e) => setNewBaby({ ...newBaby, birthdate: e.target.value })}
          className="w-full border p-2 rounded text-gray-800"
        />
        <select
          value={newBaby.gender}
          onChange={(e) => setNewBaby({ ...newBaby, gender: e.target.value })}
          className="w-full border p-2 rounded text-gray-800"
        >
          <option value="male">남아</option>
          <option value="female">여아</option>
        </select>
        <button
          onClick={handleCreateBaby}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700"
        >
          등록하기
        </button>
      </div>

      <div className="bg-white shadow p-6 rounded space-y-4">
        <h2 className="text-xl font-semibold text-gray-700">📋 등록된 아기 목록</h2>
        {babies.length === 0 ? (
          <p className="text-gray-600">등록된 아기가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {babies.map((baby) => (
              <li
                key={baby.babyNumber}
                className="p-3 border rounded hover:bg-gray-200 cursor-pointer text-gray-800"
                onClick={() => router.push(`/baby/${baby.babyNumber}`)}
              >
                <div className="font-bold">🔢 {baby.babyNumber}</div>
                <div>
                  👶 {baby.name} ({baby.gender === "male" ? "남아" : "여아"}) / 🎂 {baby.birthdate}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
