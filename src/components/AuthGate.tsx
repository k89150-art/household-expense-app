"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Props = {
  children: ReactNode;
};

const provider = new GoogleAuthProvider();
const AuthUserContext = createContext<User | null>(null);

export function useCurrentUser() {
  return useContext(AuthUserContext);
}

export function AuthGate({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  async function handleSignIn() {
    setMessage("");
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      setMessage("登入失敗。請確認 Firebase Authentication 已啟用 Google 登入，並且授權網域有加入目前網站網域。");
      console.error(error);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  if (isLoading) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>一起記</h1>
          <p className="muted">正在確認登入狀態...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>一起記</h1>
          <p className="muted">登入後即可查看家庭收支與新增紀錄。</p>
          <button className="btn" type="button" onClick={handleSignIn}>使用 Google 登入</button>
          {message ? <p className="muted">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <AuthUserContext.Provider value={user}>
      <section className="account-shell">
        <div className="account-bar">
          <div>
            <strong>{user.displayName ?? user.email}</strong>
            <div className="muted">{user.email}</div>
          </div>
          <button className="btn secondary" type="button" onClick={handleSignOut}>登出</button>
        </div>
      </section>
      {children}
    </AuthUserContext.Provider>
  );
}
