// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBl4ii299DYGkve-e531d4U08eVkpfDdIg",
  authDomain: "my-babycare-app.firebaseapp.com",
  projectId: "my-babycare-app",
  storageBucket: "my-babycare-app.firebasestorage.app",
  messagingSenderId: "307201812669",
  appId: "1:307201812669:web:9012ccbe17a93b09d16fd4",
  measurementId: "G-PFWL5ZVWQ4"
};

// 중복 초기화 방지
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore 인스턴스
const db = getFirestore(app);

export { db };
