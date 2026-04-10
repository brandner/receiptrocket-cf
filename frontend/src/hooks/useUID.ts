import { useState, useEffect } from 'react';

const UID_KEY = 'receipt_rocket_uid';

export function useUID() {
  const [uid, setUidState] = useState<string | null>(null);

  useEffect(() => {
    let storedUid = localStorage.getItem(UID_KEY);
    if (!storedUid) {
      storedUid = crypto.randomUUID();
      localStorage.setItem(UID_KEY, storedUid);
    }
    setUidState(storedUid);
  }, []);

  const overrideUid = (newUid: string) => {
    localStorage.setItem(UID_KEY, newUid);
    setUidState(newUid);
  };

  return { uid, overrideUid };
}
