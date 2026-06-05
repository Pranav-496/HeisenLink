import { useEffect, useState } from "react";

import api from "../api/client.js";

export default function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return undefined;
    }

    let socket;
    let closed = false;

    api.get("/notifications/").then(({ data }) => {
      setNotifications(data.results || data);
    });

    const connect = () => {
      const access = localStorage.getItem("heisenlink_access");
      if (!access || closed) return;
      const url = `${import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/notifications/"}?token=${access}`;
      socket = new WebSocket(url);
      socket.onmessage = (event) => {
        setNotifications((current) => [JSON.parse(event.data), ...current]);
      };
      socket.onclose = () => {
        if (!closed) window.setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      closed = true;
      if (socket) socket.close();
    };
  }, [user]);

  const markAllRead = async () => {
    await api.post("/notifications/read/");
    setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
  };

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.is_read).length,
    markAllRead,
  };
}
