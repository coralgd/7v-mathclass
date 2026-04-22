import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDMs3n-8fxsJ77pczC92w1Mu6KPuB2PZbY',
  authDomain: 'seventhvmathclass.firebaseapp.com',
  projectId: 'seventhvmathclass',
  storageBucket: 'seventhvmathclass.firebasestorage.app',
  messagingSenderId: '1045694041399',
  appId: '1:1045694041399:web:5839d5bc91ec7fdd43deb2',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
};
